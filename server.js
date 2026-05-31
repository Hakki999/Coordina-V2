const app = require('./src/app');
require('dotenv').config();

const PORT = process.env.PORT || 8080;

app.listen(PORT, err => {
    if (err) {
        console.log("❌ Error: ", err);
        return;
    }
    console.log(`✅ Server running on port localhost:${PORT}`);
})