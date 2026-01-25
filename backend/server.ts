import express from 'express';

const app = express();
const PORT = process.env.PORT || 8000;

app.get('/', (req, res) => {
    res.send('Hello World');
    console.log('endpoint hit');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
