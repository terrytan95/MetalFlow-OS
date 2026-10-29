export const palettes = [
  {
    id: "foundry",
    en: "Foundry teal",
    zh: "经典青绿",
    colors: ["#475953", "#eaf0ed", "#f5f7f6"],
  },
  {
    id: "sage",
    en: "Morandi sage",
    zh: "鼠尾草绿",
    colors: ["#525c50", "#e8ece5", "#f5f6f3"],
  },
  {
    id: "slate",
    en: "Mist blue",
    zh: "雾霾蓝",
    colors: ["#4c5864", "#e7ebef", "#f5f6f8"],
  },
  {
    id: "rose",
    en: "Dusty rose",
    zh: "豆沙粉",
    colors: ["#6e585c", "#eee7e8", "#f7f5f5"],
  },
  {
    id: "oat",
    en: "Oat & linen",
    zh: "燕麦米",
    colors: ["#635b4e", "#eeebe3", "#f7f6f3"],
  },
  {
    id: "lavender",
    en: "Lavender gray",
    zh: "薰衣草灰",
    colors: ["#5e5667", "#ece8f0", "#f6f5f8"],
  },
  {
    id: "olive",
    en: "Muted olive",
    zh: "橄榄青",
    colors: ["#575b4f", "#eaebd5", "#f6f6f3"],
  },
  {
    id: "clay",
    en: "Terracotta clay",
    zh: "陶土赭",
    colors: ["#6c5850", "#ece6e3", "#f7f5f4"],
  },
  {
    id: "stone",
    en: "Warm stone",
    zh: "暖石灰",
    colors: ["#565451", "#eae9e7", "#f6f6f5"],
  },
  {
    id: "pine",
    en: "Nordic pine",
    zh: "墨松绿",
    colors: ["#4b5b58", "#e7ecea", "#f4f6f5"],
  },
  {
    id: "sand",
    en: "Dune sand",
    zh: "灰沙褐",
    colors: ["#615a4e", "#ece8df", "#f7f6f3"],
  },
  {
    id: "mauve",
    en: "Dusty mauve",
    zh: "烟紫灰",
    colors: ["#64555f", "#ece5ea", "#f7f5f6"],
  },
  {
    id: "mono",
    en: "Black · white · gray",
    zh: "黑白灰",
    colors: ["#333333", "#e9e9e9", "#f7f7f7"],
  },
] as const;
export type PaletteId = (typeof palettes)[number]["id"];
