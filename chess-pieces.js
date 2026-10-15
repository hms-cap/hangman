// Paper Games chess pieces: an original, simple pencil-outline set (viewBox 0 0 45 45).
// Each piece is a list of [path, role]: "body" takes the piece fill, "line" is an inner detail stroke.
(function (root) {
'use strict';
const base = 'M11 36.5h23a2.2 2.2 0 0 1 2.2 2.2v2.3H8.8v-2.3a2.2 2.2 0 0 1 2.2-2.2z';
const PIECES = {
  p: [
    ['M22.5 7.5a5 5 0 1 1 0 10a5 5 0 1 1 0-10z', 'body'],
    ['M18.2 18.3h8.6a1.6 1.6 0 0 1 0 3.2h-8.6a1.6 1.6 0 0 1 0-3.2z', 'body'],
    ['M19.6 21.5h5.8c.8 5 3.2 9.6 5.6 15H14c2.4-5.4 4.8-10 5.6-15z', 'body'],
    [base, 'body'],
  ],
  r: [
    ['M12 8h4.6v3.4h3.6V8h4.6v3.4h3.6V8H33v7.6l-2.6 2.2H14.6L12 15.6z', 'body'],
    ['M15.2 17.8h14.6l1.2 15.4H14z', 'body'],
    ['M13 33.2h19l.9 3.3H12.1z', 'body'],
    [base, 'body'],
    ['M15 21.5h15', 'line'],
  ],
  n: [
    ['M14.5 36.5c-.4-6.6 2.6-10.7 6.6-13.6l-2.1-1.5c-2 1.7-4.4 3.3-6.4 4c-1.9.7-3.6-.6-3.2-2.4c1.7-5.3 4.2-9.6 7.4-13.1l.3-3.4l2.6 2.3c1.2-.4 2.3-.5 3.4-.4c6.6.4 11.6 6 11.6 15.2c0 5.3-.9 9.8-1.6 12.9z', 'body'],
    [base, 'body'],
    ['M18.4 14.2a1.1 1.1 0 1 1 0 .1', 'line'],
    ['M24.5 11.2c3.6 2 5.6 6.5 5.4 12.5', 'line'],
  ],
  b: [
    ['M22.5 3.6a2.1 2.1 0 1 1 0 4.2a2.1 2.1 0 1 1 0-4.2z', 'body'],
    ['M22.5 7.8c4.9 3.4 8 8.2 8 13c0 3.8-3.4 6.2-8 6.2s-8-2.4-8-6.2c0-4.8 3.1-9.6 8-13z', 'body'],
    ['M17 27h11a1.6 1.6 0 0 1 0 3.2H17a1.6 1.6 0 0 1 0-3.2z', 'body'],
    ['M19 30.2h7c.6 2.4 2.4 4.4 4.5 6.3h-16c2.1-1.9 3.9-3.9 4.5-6.3z', 'body'],
    [base, 'body'],
    ['M25 13.4l-4.8 6.4', 'line'],
  ],
  q: [
    ['M12.2 31L9.6 15.2l5.6 7.2l1.4-10.6l4.4 9.8l1.5-11.4l1.5 11.4l4.4-9.8l1.4 10.6l5.6-7.2L32.8 31z', 'body'],
    ['M9.6 11.6a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM16.6 8.2a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM22.5 6.4a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM28.4 8.2a2 2 0 1 1 0 4a2 2 0 1 1 0-4zM35.4 11.6a2 2 0 1 1 0 4a2 2 0 1 1 0-4z', 'body'],
    ['M12.2 31h20.6l-1 5.5H13.2z', 'body'],
    [base, 'body'],
    ['M13.3 33.6h18.4', 'line'],
  ],
  k: [
    ['M22.5 3v8.2M19 6.4h7', 'cross'],
    ['M22.5 13.2c2.5 1.6 3.2 4.6 0 9.4c-3.2-4.8-2.5-7.8 0-9.4z', 'body'],
    ['M12.8 31c-2.6-4.8-3.6-10.2-.2-13c3.8-3.2 7.8-1 9.9 4.6c2.1-5.6 6.1-7.8 9.9-4.6c3.4 2.8 2.4 8.2-.2 13z', 'body'],
    ['M12.8 31h19.4l-1 5.5H13.8z', 'body'],
    [base, 'body'],
    ['M13.9 33.6h17.2', 'line'],
  ],
};
// Render one piece as an SVG string. color: 'w' or 'b'.
function pieceSVG(type, color, cls = '') {
  return `<svg class="pc ${color} p${type} ${cls}" viewBox="0 0 45 45" aria-hidden="true">` + PIECES[type].map(([d, role]) =>
    role === 'line' ? `<path class="pl" d="${d}"/>` : role === 'cross' ? `<path class="px" d="${d}"/>` : `<path class="pb" d="${d}"/>`).join('') + '</svg>';
}
root.ChessPieces = { PIECES, pieceSVG };
})(typeof self !== 'undefined' ? self : globalThis);
