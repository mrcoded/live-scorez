import express, { Request, Response } from 'express';
import { matchRouter } from './routes/matches';

const app = express();
const PORT = 8000;

// Use JSON middleware to parse incoming JSON request bodies
app.use(express.json());


// Root GET route
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the live-scorez API!' });
});

app.use("/api/matches", matchRouter)

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
