import http from 'http';

http.get('http://localhost:3000/api/admin/migrate', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            console.log("Migration Result:", JSON.parse(rawData));
        } catch (e) {
            console.error("Parse Error:", e.message);
            console.log("Raw Response:", rawData);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
