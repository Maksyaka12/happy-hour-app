const fs = require('fs');
const filepath = "frontend/src/components/DailyRaffleSection.jsx";
const lines = fs.readFileSync(filepath, "utf-8").split("\n");

const new_lines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("{/* Raffle View Split */}") && i > 400 && i < 450) {
        skip = true;
        continue;
    }
    
    if (skip && line.includes("{/* Daily Raffle Hero Card */}")) {
        skip = false;
        new_lines.push("      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease-out' }}>");
        new_lines.push(line);
        continue;
    }
    
    if (!skip) {
        new_lines.push(line);
    }
}

fs.writeFileSync(filepath, new_lines.join("\n"), "utf-8");
