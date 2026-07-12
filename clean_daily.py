import os
filepath = "frontend/src/components/DailyRaffleSection.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "{/* Raffle View Split */}" in line and i > 400 and i < 450:
        skip = True
        continue
    
    if skip and "{/* Daily Raffle Hero Card */}" in line:
        skip = False
        new_lines.append("      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease-out' }}>\n")
        new_lines.append(line)
        continue
        
    if not skip:
        new_lines.append(line)

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
