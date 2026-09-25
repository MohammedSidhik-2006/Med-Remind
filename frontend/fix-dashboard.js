const fs = require('fs');
let c = fs.readFileSync('src/pages/Dashboard.js', 'utf8');
c = c.replace(/â€¢/g, '•').replace(/âœ“/g, '✓').replace(/â ³/g, '⏳').replace(/âœ—/g, '✗');
c = c.replace(
  '<MedicineList medicines={medicines} refreshMedicines={() => fetchDashboardData(false)} />',
  '<MedicineList medicines={medicines} setMedicines={setMedicines} refreshMedicines={() => fetchDashboardData(false)} navigate={navigate} />'
);
fs.writeFileSync('src/pages/Dashboard.js', c);
