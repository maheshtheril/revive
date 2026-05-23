const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ELITE_COORDS = {
    "logo": { "x": 40, "y": 25, "width": 45 },
    "name": { "x": 95, "y": 28, "fontSize": 16, "fontWeight": "900", "label": "{{company.name}}" },
    "hosp_info": { "x": 95, "y": 48, "fontSize": 7, "color": "#64748b", "label": "{{company.address}}  |  Ph: {{company.phone}}  |  {{company.email}}", "width": 400 },
    "line_hdr": { "type": "line", "x": 40, "y": 85, "x2": 555, "thickness": 1.5, "color": "#1e293b" },
    "bill_to": { "x": 40, "y": 100, "fontSize": 7, "fontWeight": "bold", "label": "BILL TO:", "color": "#64748b" },
    "patient_name": { "x": 40, "y": 113, "fontSize": 13, "fontWeight": "900", "label": "{{patient_name}}" },
    "patient_id": { "x": 40, "y": 131, "fontSize": 8, "label": "Hosp ID: {{patient.patient_number}}" },
    "patient_phone": { "x": 40, "y": 143, "fontSize": 8, "label": "Mob: {{patient.mobile}}" },
    "inv_data_lbl": { "x": 555, "y": 100, "fontSize": 7, "fontWeight": "bold", "label": "INVOICE DETAILS:", "align": "right", "color": "#64748b" },
    "bill_no": { "x": 555, "y": 113, "fontSize": 11, "fontWeight": "bold", "label": "ID: {{doc_number}}", "align": "right" },
    "date_hdr": { "x": 555, "y": 127, "fontSize": 8, "label": "Date: {{formatted_date}}", "align": "right" },
    "table": { "x": 40, "y": 160, "fontSize": 9, "headerFontSize": 10, "showSection": true, "qtyX": 380, "rateX": 470, "totalX": 555 },
    "line_btm": { "type": "line", "x": 400, "y": 175, "x2": 555, "thickness": 1 },
    "total_lbl": { "x": 460, "y": 190, "fontSize": 11, "fontWeight": "bold", "label": "GRAND TOTAL:", "align": "right" },
    "total_val": { "x": 555, "y": 190, "fontSize": 16, "fontWeight": "900", "label": "{{total_amount}}", "align": "right" },
    "footer": { "x": 297, "y": 750, "fontSize": 7, "label": "World-Class Healthcare | Computer Generated Documents | Powered by Antigravity Engine", "align": "center" }
};

async function run() {
    try {
        const res = await prisma.hms_print_template.update({
            where: { id: '09223ee1-8609-49a5-aece-3501fbab982a' },
            data: {
                config: { coordinates: ELITE_COORDS }
            }
        });
        console.log("SUCCESS! Database record 09223ee1 updated with Elite Coordinates.");
        console.log("Verify now with: SELECT config->'coordinates' FROM hms_print_template WHERE id = '09223ee1-8609-49a5-aece-3501fbab982a';");
    } catch (e) {
        console.error("FAILED TO INJECT:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
