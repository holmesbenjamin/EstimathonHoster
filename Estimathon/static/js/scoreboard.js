// static/js/scoreboard.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Scoreboard JS loaded.");

    const socket = io('/scoreboard');

    socket.on('connect', function() {
        console.log("Connected to the server on /scoreboard namespace.");
    });

    socket.on('disconnect', function() {
        console.log("Disconnected from server.");
    });

    socket.on('all_team_stats_update', function(allTeamStats) {
        console.log("Received all team stats update:", allTeamStats); 
        updateScoreboard(allTeamStats);
    });

    function updateScoreboard(allTeamStats) {
        console.log("Updating scoreboard...");
        const scoreboardDiv = document.getElementById('scoreboard');
        let html = '<table><tr><th>Rank</th><th>Team Name</th><th>Score</th></tr>';

        allTeamStats.forEach((teamStats, index) => {
            const highlightClass = index === 0 ? 'top-team' : '';
            html += `<tr class="${highlightClass}">
                        <td>${index + 1}</td>
                        <td>${teamStats.team_name}</td>
                        <td>${teamStats.score.toFixed(2)}</td>
                     </tr>`;
        });
        html += '</table>';
        scoreboardDiv.innerHTML = html;
    }
});
