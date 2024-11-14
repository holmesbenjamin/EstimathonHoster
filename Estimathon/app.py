# app.py
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, Namespace
from datetime import datetime
import math
from models import db, Team, Submission

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///estimation_game.db'
db.init_app(app)

socketio = SocketIO(app, async_mode='eventlet')

PROBLEMS = [
    {'id': 1, 'description': 'Estimate the population of City X.', 'correct_answer': 500000},
    {'id': 2, 'description': 'Estimate the height of Mount Y.', 'correct_answer': 8000},
]

TOTAL_PROBLEMS = 13
TOTAL_SUBMISSIONS_ALLOWED = 18

@app.route('/')
def index():
    return render_template('index.html', problems=PROBLEMS)

@app.route('/scoreboard')
def scoreboard():
    return render_template('scoreboard.html')

@app.route('/get_teams')
def get_teams():
    teams = Team.query.all()
    team_list = [{'id': team.id, 'name': team.name} for team in teams]
    return jsonify({'teams': team_list})

@app.route('/add_team', methods=['POST'])
def add_team():
    team_name = request.form['team_name']
    team = Team(name=team_name)
    db.session.add(team)
    db.session.commit()
    update_all_team_stats()
    return jsonify({'success': True, 'team_id': team.id})

@app.route('/submit_interval', methods=['POST'])
def submit_interval():
    data = request.get_json()
    team_id = int(data['team_id'])
    problem_id = int(data['problem_id'])
    min_value = float(data['min_value'])
    max_value = float(data['max_value'])

    print(f"Received submission from Team {team_id} for Problem {problem_id}")

    if min_value <= 0 or max_value <= 0 or min_value > max_value:
        print("Invalid interval submitted.")
        return jsonify({'success': False, 'message': 'Invalid interval.'}), 400

    total_submissions = Submission.query.filter_by(team_id=team_id).count()
    if total_submissions >= TOTAL_SUBMISSIONS_ALLOWED:
        print("Submission limit reached for team.")
        return jsonify({'success': False, 'message': 'Submission limit reached.'}), 400

    submission = Submission(
        team_id=team_id,
        problem_id=problem_id,
        min_value=min_value,
        max_value=max_value,
        timestamp=datetime.utcnow()
    )
    db.session.add(submission)
    db.session.commit()

    update_all_team_stats()
    print(f"New submission logged: Team ID {team_id}, Problem ID {problem_id}, Min: {min_value}, Max: {max_value}")
    return jsonify({'success': True})

def update_all_team_stats():
    teams = Team.query.all()
    all_team_stats = []

    for team in teams:
        submissions = Submission.query.filter_by(team_id=team.id).order_by(Submission.timestamp).all()
        total_submissions = len(submissions)
        last_submissions = {}
        good_intervals = 0
        max_min_sums = 0  

        for submission in submissions:
            last_submissions[submission.problem_id] = submission

        answered_problems = set(last_submissions.keys())

        submission_details = []
        for problem_id, submission in last_submissions.items():
            problem = next((p for p in PROBLEMS if p['id'] == problem_id), None)
            is_good = False
            if problem:
                correct_answer = problem['correct_answer']
                if submission.min_value <= correct_answer <= submission.max_value:
                    is_good = True
                    good_intervals += 1
                    if submission.min_value > 0:
                        ratio = submission.max_value / submission.min_value
                        max_min_sums += ratio
                        print(f"Team {team.id} - Problem {submission.problem_id}: max/min ratio = {ratio}")
                    else:
                        print(f"Team {team.id} - Problem {submission.problem_id}: min_value is zero or negative, cannot compute max/min ratio.")
                else:
                    print(f"Team {team.id} - Problem {submission.problem_id}: Interval does not contain correct answer.")
            else:
                print(f"Problem {submission.problem_id} not found.")

            submission_details.append({
                'team_id': team.id,
                'problem_id': submission.problem_id,
                'min_value': submission.min_value,
                'max_value': submission.max_value,
                'is_good': is_good
            })

        exponent_factor = TOTAL_PROBLEMS - good_intervals
        if exponent_factor < 0:
            exponent_factor = 0  
        score = (10 + max_min_sums) * (2 ** exponent_factor)
        print(f"Team {team.id} - Score calculated: {score}")

        stats = {
            'team_id': team.id,
            'team_name': team.name,
            'questions_answered': len(answered_problems),
            'correct_answers': good_intervals,
            'submissions_used': total_submissions,
            'submission_details': submission_details,
            'score': score
        }
        all_team_stats.append(stats)

    all_team_stats.sort(key=lambda x: x['score'])

    socketio.emit('all_team_stats_update', all_team_stats, namespace='/scoreboard')
    print("Emitting updated stats to all clients")  

class ScoreboardNamespace(Namespace):
    def on_connect(self):
        print("Client connected to /scoreboard namespace")

    def on_disconnect(self):
        print("Client disconnected from /scoreboard namespace")

socketio.on_namespace(ScoreboardNamespace('/scoreboard'))

if __name__ == '__main__':
    with app.app_context():
        db.drop_all()
        db.create_all()  
    socketio.run(app, host='0.0.0.0', port=5000)