import * as fs from 'fs';

let navContent = fs.readFileSync('./src/app/actions/navigation.ts', 'utf-8');

navContent = navContent.replace(
    'const session = await auth();',
    `const session = {
        user: {
            id: '7d17d6fd-f29a-474d-a9a4-87db985681be',
            email: 'reception1@hospital.com',
            name: 'Receptionist One',
            role: 'Receptionist',
            tenantId: '00000000-0000-0000-0000-000000000001'
        }
    };`
);

navContent = navContent.replace(
    "import { unstable_noStore as noStore } from 'next/cache';",
    "const noStore = () => {};"
);

navContent = navContent.replace("'use server'", "");

fs.writeFileSync('./src/app/actions/temp-nav.ts', navContent);
console.log("Created src/app/actions/temp-nav.ts");
