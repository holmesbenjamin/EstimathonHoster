// static/js/main.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Main JS loaded.");

    const socket = io('/scoreboard');

    socket.on('connect', function() {
        console.log("Connected to the server on /scoreboard namespace.");
    });

    socket.on('disconnect', function() {
        console.log("Disconnected from server.");
    });

    fetchTeams(); 

    document.getElementById('add-team-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        console.log("Submitting new team:", formData.get('team_name'));
        
        fetch('/add_team', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log("Add team response:", data);
            if (data.success) {
                alert('Team added successfully.');
                fetchTeams(); 
                e.target.reset(); 
            }
        });
    });

    document.getElementById('submit-interval-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const teamId = e.target.team_id.value;
        const problemId = e.target.problem_id.value;
        const minValue = parseFloat(e.target.min_value.value);
        const maxValue = parseFloat(e.target.max_value.value);

        console.log(`Submitting interval for Team ID ${teamId}, Problem ID ${problemId}, Min: ${minValue}, Max: ${maxValue}`);

        fetch('/submit_interval', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                team_id: teamId,
                problem_id: problemId,
                min_value: minValue,
                max_value: maxValue
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log("Submit interval response:", data);
            if (data.success) {
                alert('Interval submitted successfully.');
                e.target.reset();
            } else {
                alert(`Error: ${data.message}`);
            }
        });
    });

    function fetchTeams() {
        console.log("Fetching teams...");
        fetch('/get_teams')
            .then(response => response.json())
            .then(data => {
                console.log("Teams fetched:", data);
                const teamSelect = document.querySelector('select[name="team_id"]');
                teamSelect.innerHTML = '<option value="">Select Team</option>';

                data.teams.forEach(team => {
                    const option = document.createElement('option');
                    option.value = team.id;
                    option.textContent = team.name;
                    teamSelect.appendChild(option);
                });
            });
    }

    socket.on('all_team_stats_update', function(allTeamStats) {
        console.log("Received all team stats update:", allTeamStats); 
        const submissionsLog = document.querySelector('#submissions-log tbody');
        const dashboard = document.querySelector('#dashboard');

        submissionsLog.innerHTML = ''; 
        dashboard.innerHTML = ''; 

        allTeamStats.forEach(teamStats => {
            teamStats.submission_details.forEach(sub => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${sub.team_id}</td>
                    <td>${sub.problem_id}</td>
                    <td>${sub.min_value}</td>
                    <td>${sub.max_value}</td>
                    <td>${sub.is_good ? 'Good' : 'Not Good'}</td>
                `;
                submissionsLog.appendChild(row);
            });

            const teamDiv = document.createElement('div');
            teamDiv.classList.add('team-stats');
            teamDiv.innerHTML = `
                <h3>Team: ${teamStats.team_name} (ID: ${teamStats.team_id})</h3>
                <p>Questions Answered: ${teamStats.questions_answered} / 13</p>
                <p>Correct Answers: ${teamStats.correct_answers} / 13</p>
                <p>Submissions Used: ${teamStats.submissions_used} / 18</p>
            `;
            dashboard.appendChild(teamDiv);
        });
    });

    window.sortSubmissions = function(by) {
        console.log(`Sorting submissions by ${by}...`);
        const submissionsLog = document.querySelector('#submissions-log tbody');
        const rows = Array.from(submissionsLog.querySelectorAll('tr'));

        rows.sort((a, b) => {
            const valA = a.children[by === 'team' ? 0 : 1].innerText;
            const valB = b.children[by === 'team' ? 0 : 1].innerText;
            return valA.localeCompare(valB);
        });

        rows.forEach(row => submissionsLog.appendChild(row));
    };
});
