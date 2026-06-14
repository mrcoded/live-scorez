import express, { Request, Response } from 'express';

const app = express();
const PORT = 8000;

// Use JSON middleware to parse incoming JSON request bodies
app.use(express.json());

// Root GET route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the live-scorez API!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
