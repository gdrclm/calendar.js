const mounth = [
  { name: "Сентябрь", days: 30 },
  { name: "Окрябрь", days: 31 }
];
const day1 = document.querySelectorAll(".day_week")[0];

const numberOfMonth = mounth[0];

for (let i = 1; i <= numberOfMonth.days; i++) {
  day1.innerHTML += `<li>${i}</diliv>`;
  console.log(day1);
}
