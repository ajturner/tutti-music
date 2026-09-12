# Design
`expShape(shape, depth, fraction)` in `render.js` returns a 0 to 1 multiplier; swell rises to a peak at 60 % then falls, sfz holds for 12 % then drops by 60 % of depth, fades are linear. The renderer samples every 30 ticks inside each note part, scaling the expression lane's value (default 127), and restores the lane value at the note end. Schema fx enum gains EXP; default EXP 1C.
