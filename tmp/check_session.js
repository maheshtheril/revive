const { auth } = require('./src/auth');
const run = async () => {
    const session = await auth();
    console.log("SESSION:", JSON.stringify(session?.user, null, 2));
};
run();
