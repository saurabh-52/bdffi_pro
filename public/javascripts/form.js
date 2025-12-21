/*
 * Interactive 2D Mascot Logic
 * Developed By: Visernic Limited
 */

console.log("%c Visernic Limited %c 2D Interactive UI ", "background: #2d3436; color: #fff; padding: 5px; border-radius: 4px;", "color: #0984e3; font-weight: bold;");

const robot = document.getElementById('viserBot');
const nameInput = document.getElementById('nameInput');
const mobNum = document.getElementById('mobNum');

// 1. Name Input - Waving
nameInput.addEventListener('focus', () => {
  resetRobot();
  robot.classList.add('waving');
});

// 2. mobNum Input - Reading/Observing
mobNum.addEventListener('focus', () => {
  resetRobot();
  robot.classList.add('reading');
});
// Reset on Blur
const inputs = document.querySelectorAll('input');
inputs.forEach(input => {
  input.addEventListener('blur', () => {
    resetRobot();
  });
});

function resetRobot() {
  robot.classList.remove('waving', 'reading', 'shy');
}

function submitForm() {
  const btn = document.querySelector('.btn-submit');
  btn.innerText = "Processing...";
  setTimeout(() => {
    btn.innerText = "Request Submitted !";
    btn.style.background = "#00b894"; // Success Green
    
    // Robot Celebration
    resetRobot();
    robot.classList.add('waving');
  }, 1500);
}