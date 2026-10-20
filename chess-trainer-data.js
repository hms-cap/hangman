// Chess Trainer tactic drills, built and engine-checked by tools/generate-chess-trainer.js.
// Each: [FEN, solution in UCI (solver, reply, solver, ...), other accepted moves for each solver move ('|' between moves),
//        theme, explanation, material won in pawns]
window.CHESS_TRAINER_DATA = {
knightFork: [
["2N5/8/1p6/1kp2q2/3p4/2PP4/8/K7 w - - 0 1","c8d6 b5c6 d6f5","|","fork","Fork: Nd6+ forks the king on b5 and the queen on f5. After Kc6, Nxf5 wins the queen.",9],
["3k4/8/8/1p6/PP3n2/4Q3/8/4K3 b - - 0 1","f4g2 e1f2 g2e3","|","fork","Fork: Ng2+ forks the king on e1 and the queen on e3. After Kf2, Nxe3 wins the queen.",9],
["6k1/8/8/8/4p3/4n3/1Q3KP1/8 b - - 0 1","e3d1 f2e2 d1b2","|","fork","Fork: Nd1+ forks the king on f2 and the queen on b2. After Ke2, Nxb2 wins the queen.",9],
["N3q3/8/4k3/4p3/8/8/3K4/8 w - - 0 1","a8c7 e6d7 c7e8","|","fork","Fork: Nc7+ forks the king on e6 and the queen on e8. After Kd7, Nxe8 wins the queen.",9],
["k7/8/5R2/7P/3P4/6K1/5n2/8 b - - 0 1","f2e4 g3f4 e4f6","|","fork","Fork: Ne4+ forks the king on g3 and the rook on f6. After Kf4, Nxf6 wins the rook.",5],
["n6N/4q3/8/1P2k3/7P/8/1K6/8 w - - 0 1","h8g6 e5d6 g6e7","|","fork","Fork: Ng6+ forks the king on e5 and the queen on e7. After Kd6, Nxe7 wins the queen.",9],
["2r5/8/8/3k1N2/8/2P5/2P5/7K w - - 0 1","f5e7 d5c4 e7c8","|","fork","Fork: Ne7+ forks the king on d5 and the rook on c8. After Kc4, Nxc8 wins the rook.",5],
["8/5kp1/8/8/8/nPK5/3R4/8 b - - 0 1","a3b1 c3c2 b1d2","|","fork","Fork: Nb1+ forks the king on c3 and the rook on d2. After Kc2, Nxd2 wins the rook.",5],
["4N3/8/8/5k1r/P7/8/6K1/8 w - - 0 1","e8g7 f5g6 g7h5","|","fork","Fork: Ng7+ forks the king on f5 and the rook on h5. After Kg6, Nxh5 wins the rook.",5],
["1k6/4N3/7p/P7/3q2p1/8/5P2/5K2 w - - 0 1","e7c6 b8c7 c6d4","|","fork","Fork: Nc6+ forks the king on b8 and the queen on d4. After Kc7, Nxd4 wins the queen.",9],
["k7/8/8/8/5K2/6Q1/1PP5/6n1 b - - 0 1","g1e2 f4f3 e2g3","|","fork","Fork: Ne2+ forks the king on f4 and the queen on g3. After Kf3, Nxg3 wins the queen.",9],
["r1k5/8/8/8/N7/8/6K1/8 w - - 0 1","a4b6 c8b8 b6a8","|","fork","Fork: Nb6+ forks the king on c8 and the rook on a8. After Kb8, Nxa8 wins the rook.",5],
["8/5k2/5p2/2P5/1p6/8/3R3K/6n1 b - - 0 1","g1f3 h2g3 f3d2","|","fork","Fork: Nf3+ forks the king on h2 and the rook on d2. After Kg3, Nxd2 wins the rook.",5],
["8/4p3/3p4/2b5/NPk4P/3q4/8/K7 w - - 0 1","a4b2 c4d4 b2d3","|","fork","Fork: Nb2+ forks the king on c4 and the queen on d3. After Kd4, Nxd3 wins the queen.",9],
["8/1pk5/1p6/6n1/8/8/1P6/4Q1K1 b - - 0 1","g5f3 g1f1 f3e1","|","fork","Fork: Nf3+ forks the king on g1 and the queen on e1. After Kf1, Nxe1 wins the queen.",9],
["5k2/8/1pp5/2P5/3Q4/n1K5/8/B7 b - - 0 1","a3b5 c3c4 b5d4","|","fork","Fork: Nb5+ forks the king on c3 and the queen on d4. After Kc4, Nxd4 wins the queen.",9],
["7k/3R4/n7/8/K7/5P2/8/8 b - - 0 1","a6c5 a4b4 c5d7","|","fork","Fork: Nc5+ forks the king on a4 and the rook on d7. After Kb4, Nxd7 wins the rook.",5],
["8/8/7b/8/5k1q/8/8/4NK2 w - - 0 1","e1g2 f4g5 g2h4","|","fork","Fork: Ng2+ forks the king on f4 and the queen on h4. After Kg5, Nxh4 wins the queen.",9],
["k7/8/8/7K/8/1R1n4/4R3/8 b - - 0 1","d3f4 h5g5 f4e2","|","fork","Fork: Nf4+ forks the king on h5 and the rook on e2. After Kg5, Nxe2 wins the rook.",5],
["8/2p3r1/5k2/2p5/8/6N1/5K2/8 w - - 0 1","g3h5 f6f7 h5g7","|","fork","Fork: Nh5+ forks the king on f6 and the rook on g7. After Kf7, Nxg7 wins the rook.",5],
["8/8/2q1k3/5N2/8/8/8/6K1 w - - 0 1","f5d4 e6d7 d4c6","|","fork","Fork: Nd4+ forks the king on e6 and the queen on c6. After Kd7, Nxc6 wins the queen.",9],
["4k3/8/8/7K/1p2p3/7n/1P2R3/8 b - - 0 1","h3f4 h5g4 f4e2","|","fork","Fork: Nf4+ forks the king on h5 and the rook on e2. After Kg4, Nxe2 wins the rook.",5],
["8/1p2k3/8/8/P7/4n3/1K3Q2/8 b - - 0 1","e3d1 b2b3 d1f2","|","fork","Fork: Nd1+ forks the king on b2 and the queen on f2. After Kb3, Nxf2 wins the queen.",9],
["8/k7/8/1P5P/2Q1K3/8/8/1n6 b - - 0 1","b1d2 e4d3 d2c4","|","fork","Fork: Nd2+ forks the king on e4 and the queen on c4. After Kd3, Nxc4 wins the queen.",9],
["4k3/5p2/8/1r6/1p2N3/P7/8/5K2 w - - 0 1","e4d6 e8e7 d6b5","|","fork","Fork: Nd6+ forks the king on e8 and the rook on b5. After Ke7, Nxb5 wins the rook.",5],
["8/2k5/8/7n/8/2P1N3/4R3/7K b - - 0 1","h5g3 h1h2 g3e2","|","fork","Fork: Ng3+ forks the king on h1 and the rook on e2. After Kh2, Nxe2 wins the rook.",5],
["1N6/pn6/1p6/q3k3/8/8/8/3K4 w - - 0 1","b8c6 e5d5 c6a5","|","fork","Fork: Nc6+ forks the king on e5 and the queen on a5. After Kd5, Nxa5 wins the queen.",9],
["2k5/4p3/1p6/8/N1q5/7P/8/3K4 w - - 0 1","a4b6 c8c7 b6c4","|","fork","Fork: Nxb6+ forks the king on c8 and the queen on c4. After Kc7, Nxc4 wins the queen.",10],
["2k5/6p1/8/8/5n2/8/5Q2/6K1 b - - 0 1","f4h3 g1f1 h3f2","|","fork","Fork: Nh3+ forks the king on g1 and the queen on f2. After Kf1, Nxf2 wins the queen.",9],
["8/3N4/6k1/8/2r5/7P/3K4/8 w - - 0 1","d7e5 g6f5 e5c4","|","fork","Fork: Ne5+ forks the king on g6 and the rook on c4. After Kf5, Nxc4 wins the rook.",5],
["8/3k4/8/8/5N1P/2n1Q3/2P2K2/8 b - - 0 1","c3d1 f2e2 d1e3","|","fork","Fork: Nd1+ forks the king on f2 and the queen on e3. After Ke2, Nxe3 wins the queen.",9],
["7k/1n6/p1Q5/8/2K5/8/8/8 b - - 0 1","b7a5 c4d5 a5c6","|","fork","Fork: Na5+ forks the king on c4 and the queen on c6. After Kd5, Nxc6 wins the queen.",9],
["8/7b/3r4/k1N5/4P3/8/2K5/8 w - - 0 1","c5b7 a5b6 b7d6","|","fork","Fork: Nb7+ forks the king on a5 and the rook on d6. After Kb6, Nxd6 wins the rook.",5],
["8/3N2nq/1p4k1/7p/2P5/8/8/3K4 w - - 0 1","d7f8 g6h6 f8h7","|","fork","Fork: Nf8+ forks the king on g6 and the queen on h7. After Kh6, Nxh7 wins the queen.",9],
["8/8/8/8/4P1k1/2P2q2/3K4/5N2 w - - 0 1","f1h2 g4f4 h2f3","|","fork","Fork: Nh2+ forks the king on g4 and the queen on f3. After Kf4, Nxf3 wins the queen.",9],
["3k4/4p3/8/7p/2Q3n1/8/8/3K4 b - - 0 1","g4e3 d1e2 e3c4","|","fork","Fork: Ne3+ forks the king on d1 and the queen on c4. After Ke2, Nxc4 wins the queen.",9],
["8/k4p2/8/7Q/8/8/4K3/7n b - - 0 1","h1g3 e2e3 g3h5","|","fork","Fork: Ng3+ forks the king on e2 and the queen on h5. After Ke3, Nxh5 wins the queen.",9],
["8/8/8/1kP5/8/8/3Pq3/1NK5 w - - 0 1","b1c3 b5c5 c3e2","|","fork","Fork: Nc3+ forks the king on b5 and the queen on e2. After Kxc5, Nxe2 wins the queen.",8],
["8/1k6/8/1p6/5Q2/2n5/1P6/6K1 b - - 0 1","c3e2 g1f2 e2f4","|","fork","Fork: Ne2+ forks the king on g1 and the queen on f4. After Kf2, Nxf4 wins the queen.",9],
["8/k7/6R1/8/4P3/5K2/5Pn1/5N2 b - - 0 1","g2h4 f3e3 h4g6","|","fork","Fork: Nh4+ forks the king on f3 and the rook on g6. After Ke3, Nxg6 wins the rook.",5]
],
fork: [
["8/2n4k/8/P2p4/8/8/2K5/5R2 w - - 0 1","f1f7 h7g6 f7c7","|","fork","Fork: Rf7+ forks the king on h7 and the knight on c7. After Kg6, Rxc7 wins the knight.",3],
["8/1k6/7B/8/4q3/6K1/8/8 b - - 0 1","e4g6 g3f3 g6h6","|","fork","Fork: Qg6+ forks the king on g3 and the bishop on h6. After Kf3, Qxh6 wins the bishop.",3],
["7q/2pk1K2/6Rp/8/5P2/8/4N3/8 b - - 0 1","h8e8 f7g7 e8e2","|","fork","Fork: Qe8+ forks the king on f7 and the knight on e2. After Kg7, Qxe2 wins the knight.",3]
],
pin: [
["8/2kb4/3p4/8/4NP2/8/2K5/8 b - - 0 1","d7f5 c2c3 f5e4","|","pin","Pin: Bf5 pins the knight on e4 to the king on c2: it can't move. After Kc3, Bxe4 wins the knight.",3],
["8/8/8/8/k5B1/1n6/K7/8 w - - 0 1","g4d1 a4b4 d1b3","|","pin","Pin: Bd1 pins the knight on b3 to the king on a4: it can't move. After Kb4, Bxb3 wins the knight.",3],
["8/6p1/5k2/R3r2p/2P5/8/2P5/3KB3 w - - 0 1","e1c3 g7g5 c3e5","|a5e5","pin","Pin: Bc3 pins the rook on e5 to the king on f6: it can't move. After g5, Bxe5+ wins the rook.",5],
["8/2k5/b7/4P3/3K4/3N4/8/5r2 b - - 0 1","f1d1 d4d5 a6d3","|d1d3","pin","Pin: Rd1 pins the knight on d3 to the king on d4: it can't move. After Kd5, Bxd3 wins the knight.",3]
],
skewer: [
["6N1/6k1/4K3/8/8/8/8/3b4 b - - 0 1","d1b3 e6f5 g7g8","d1g4 g7g8|b3g8","skewer","Skewer: Bb3+ attacks the king on e6, and when it moves the knight on g8 behind it falls. After Kf5, Kxg8 wins the knight.",3],
["3b3k/8/8/8/4P3/2K4P/3Q4/8 b - - 0 1","d8a5 c3c2 a5d2","|","skewer","Skewer: Ba5+ attacks the king on c3, and when it moves the queen on d2 behind it falls. After Kc2, Bxd2 wins the queen.",9],
["1B6/1p6/8/4p3/8/4kP2/4Pb2/3K4 w - - 0 1","b8a7 e3f4 a7f2","|","skewer","Skewer: Ba7+ attacks the king on e3, and when it moves the bishop on f2 behind it falls. After Kf4, Bxf2 wins the bishop.",3],
["7R/4p3/2k5/2q4P/3p4/8/KP6/8 w - - 0 1","h8c8 c6d6 c8c5","|","skewer","Skewer: Rc8+ attacks the king on c6, and when it moves the queen on c5 behind it falls. After Kd6, Rxc5 wins the queen.",9],
["8/7k/p7/q7/7P/3K4/6P1/5R2 b - - 0 1","a5b5 d3e3 b5f1","|","skewer","Skewer: Qb5+ attacks the king on d3, and when it moves the rook on f1 behind it falls. After Ke3, Qxf1 wins the rook.",5],
["7R/r2k4/8/8/8/1P6/8/2K5 w - - 0 1","h8h7 d7e6 h7a7","|","skewer","Skewer: Rh7+ attacks the king on d7, and when it moves the rook on a7 behind it falls. After Ke6, Rxa7 wins the rook.",5],
["8/3p1k2/8/2q5/8/5K2/8/7Q b - - 0 1","c5d5 f3e3 d5h1","c5c6|","skewer","Skewer: Qd5+ attacks the king on f3, and when it moves the queen on h1 behind it falls. After Ke3, Qxh1 wins the queen.",9],
["1R6/8/8/3p4/5kq1/8/2P5/5K2 w - - 0 1","b8b4 f4g5 b4g4","|","skewer","Skewer: Rb4+ attacks the king on f4, and when it moves the queen on g4 behind it falls. After Kg5, Rxg4+ wins the queen.",9],
["2R5/3p4/6k1/8/p7/6q1/2K5/8 w - - 0 1","c8g8 g6f5 g8g3","|","skewer","Skewer: Rg8+ attacks the king on g6, and when it moves the queen on g3 behind it falls. After Kf5, Rxg3 wins the queen.",9],
["8/1p2k2r/8/8/7P/8/8/1R1K4 w - - 0 1","b1b7 e7f6 b7h7","|","skewer","Skewer: Rxb7+ attacks the king on e7, and when it moves the rook on h7 behind it falls. After Kf6, Rxh7 wins the rook.",6],
["8/5p1q/8/5k2/8/8/6K1/2Q5 w - - 0 1","c1c2 f5e5 c2h7","c1b1|","skewer","Skewer: Qc2+ attacks the king on f5, and when it moves the queen on h7 behind it falls. After Ke5, Qxh7 wins the queen.",9],
["2n5/8/4p3/2k3p1/8/8/K7/7R w - - 0 1","h1c1 c5d5 c1c8","|","skewer","Skewer: Rc1+ attacks the king on c5, and when it moves the knight on c8 behind it falls. After Kd5, Rxc8 wins the knight.",3],
["8/1B6/8/8/2k5/7P/4r2P/7K w - - 0 1","b7a6 c4d5 a6e2","|","skewer","Skewer: Ba6+ attacks the king on c4, and when it moves the rook on e2 behind it falls. After Kd5, Bxe2 wins the rook.",5],
["k7/b7/3K4/8/4P3/1P4R1/8/8 b - - 0 1","a7b8 d6d5 b8g3","|","skewer","Skewer: Bb8+ attacks the king on d6, and when it moves the rook on g3 behind it falls. After Kd5, Bxg3 wins the rook.",5]
],
mixed: [
["8/1p1bk2p/2r5/1Qpp1b1p/3BP2p/2BP3P/2n2P2/1KR5 b - - 0 1","c2a3 b1b2 a3b5","|","fork","Fork: Na3+ forks the king on b1 and the queen on b5. After Kb2, Nxb5 wins the queen.",9],
["2k1b3/rn5p/p3p2p/p1pPn2P/2P2Qp1/3QBP2/3P1B2/4K3 b - - 0 1","e5d3","","fork","Fork: Nxd3+ forks the king on e1 and the bishop on f2 and the queen on f4.",9],
["r3r2b/pk4p1/p3p1p1/K1P1nP1P/p6N/Q5PB/3P1P2/2N5 b - - 0 1","e5c4 a5a4 c4a3","|","fork","Fork: Nc4+ forks the king on a5 and the pawn on d2 and the queen on a3. After Kxa4, Nxa3 wins the queen.",8],
["8/4pkb1/3pp3/2P4p/nRB5/2P4N/5PP1/3RK3 b - - 0 1","g7c3 e1f1 c3b4","|","fork","Fork: Bxc3+ forks the king on e1 and the rook on b4. After Kf1, Bxb4 wins the rook.",6],
["b6b/4q1b1/3rpN1k/pp1pP2p/p6P/RP6/2P1P1PP/7K w - - 0 1","f6g8 h6h7 g8e7","|","fork","Fork: Ng8+ forks the king on h6 and the queen on e7. After Kh7, Nxe7 wins the queen.",9],
["1b5n/p1p2p1b/k1p5/5P2/pPp2P2/1q1N3P/4PR2/B1K5 w - - 0 1","d3c5 a6b6 c5b3","|","fork","Fork: Nc5+ forks the king on a6 and the queen on b3. After Kb6, Nxb3 wins the queen.",9],
["n7/p3k2p/n7/1pp1pp2/1nP2PpP/BPQ1PPB1/P1N2Q2/2K5 b - - 0 1","b4a2 c1d2 a2c3","|","fork","Fork: Nxa2+ forks the king on c1 and the queen on c3. After Kd2, Nxc3 wins the queen.",10],
["2kb3n/1p5p/7p/1N3qp1/P5pP/PP6/K2PBP2/5B2 w - - 0 1","b5d6 c8c7 d6f5","|","fork","Fork: Nd6+ forks the king on c8 and the queen on f5. After Kc7, Nxf5 wins the queen.",9]
],
combo: [
["q1N5/8/8/2k1p3/P5R1/6P1/8/3K4 w - - 0 1","g4c4 c5c4 c8b6 c4b4 b6a8","||","fork","Rc4+ forces Kxc4. Now Nb6+ forks the king on c4 and the queen on a8. After Kb4, Nxa8 wins the queen.",4]
]
};
