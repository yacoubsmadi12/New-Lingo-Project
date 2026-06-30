## Packages
framer-motion | Page transitions and complex interactive animations
recharts | Visualizing user progress and leaderboard stats
canvas-confetti | Celebration effects for winning quizzes and earning badges
@types/canvas-confetti | Types for confetti
socket.io-client | Real-time communication for duels
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind classes efficiently

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
}
Socket connection should point to window.location.host
Auth requires handling 401 globally
