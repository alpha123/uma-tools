dataSetVersion = "2023-11-22"; // Change this when creating a new data set version. YYYY-MM-DD format.
dataSet[dataSetVersion] = {};

dataSet[dataSetVersion].options = [
  {
    name: "Filter by School",
    key: "school",
    tooltip: "Check this to restrict characters from certain school.",
    checked: false,
    sub: [
      { name: "Abydos High School", key: "Abydos" },
      { name: "Gehenna Academy", key: "Gehenna" },
      { name: "Millennium Science School", key: "Millenium" },
      { name: "Trinity General School", key: "Trinity" },
      { name: "Hyakkiyako Alliance Academy", key: "Hyakkiyako" },
      { name: "Shanhaijing Senior Secondary School", key: "Shanhaijing" },
      { name: "Red Winter Federal Academy", key: "RedWinter" },
      { name: "Valkyrie Police Academy", key: "Valkyrie" },
      { name: "Arius Branch School", key: "Arius" },
      { name: "SRT Special Academy", key: "SRT" },
      { name: "Other", key: "Other" },
    ]
  },
  {
    name: "Disable NPC Students",
    key: "NPC",
    tooltip: "Check this to disable NPC characters (based on Japan Server).",
    checked: false
  },
  {
    name: "Disable Collab Character",
    key: "collab",
    tooltip: "Check this to disable collab characters (Hatsune Miku, Misaka Mikoto, etc.)",
    checked: false
  },
  {
    name: "Remove Duplicate Characters",
    key: "dupes",
    tooltip: "Check this to remove Duplicate characters (ex. Shun and Small Shun)."
  }
  /*
  {
    name: "Remove Non-Girls",
    key: "notgirl",
    tooltip: "Check this to remove all non-female characters."
  },
  */
  
];

dataSet[dataSetVersion].characterData = [{"name": "Ayane (Swimsuit)", "img": "ayane_swimsuit.png", "opts": {"school": ["Abydos"]}}, {"name": "Hoshino (Swimsuit)", "img": "hoshino_swimsuit.png", "opts": {"school": ["Abydos"]}}, {"name": "Nonomi (Swimsuit)", "img": "nonomi_swimsuit.png", "opts": {"school": ["Abydos"]}}, {"name": "Serika (New Year)", "img": "serika_new_year.png", "opts": {"school": ["Abydos"]}}, {"name": "Shiroko (Riding)", "img": "shiroko_riding.png", "opts": {"school": ["Abydos"]}}, {"name": "Shiroko (Swimsuit)", "img": "shiroko_swimsuit.png", "opts": {"school": ["Abydos"]}}, {"name": "Aru (New Year)", "img": "aru_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Chinatsu (Hot Spring)", "img": "chinatsu_hot_spring.png", "opts": {"school": ["Gehenna"]}}, {"name": "Fuuka (New Year)", "img": "fuuka_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Haruka (New Year)", "img": "haruka_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Haruna (New Year)", "img": "haruna_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Haruna (Sportswear)", "img": "haruna_sportswear.png", "opts": {"school": ["Gehenna"]}}, {"name": "Hina (Swimsuit)", "img": "hina_swimsuit.png", "opts": {"school": ["Gehenna"]}}, {"name": "Iori (Swimsuit)", "img": "iori_swimsuit.png", "opts": {"school": ["Gehenna"]}}, {"name": "Izumi (Swimsuit)", "img": "izumi_swimsuit.png", "opts": {"school": ["Gehenna"]}}, {"name": "Junko (New Year)", "img": "junko_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Kayoko (New Year)", "img": "kayoko_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Mutsuki (New Year)", "img": "mutsuki_new_year.png", "opts": {"school": ["Gehenna"]}}, {"name": "Chise (Swimsuit)", "img": "chise_swimsuit.png", "opts": {"school": ["Hyakkiyako"]}}, {"name": "Izuna (Swimsuit)", "img": "izuna_swimsuit.png", "opts": {"school": ["Hyakkiyako"]}}, {"name": "Mimori (Swimsuit)", "img": "mimori_swimsuit.png", "opts": {"school": ["Hyakkiyako"]}}, {"name": "Shizuko (Swimsuit)", "img": "shizuko_swimsuit.png", "opts": {"school": ["Hyakkiyako"]}}, {"name": "Wakamo (Swimsuit)", "img": "wakamo_swimsuit.png", "opts": {"school": ["Hyakkiyako"]}}, {"name": "Akane (Bunny Girl)", "img": "akane_bunny_girl.png", "opts": {"school": ["Millenium"]}}, {"name": "Arisu (Maid)", "img": "arisu_maid.png", "opts": {"school": ["Millenium"]}}, {"name": "Asuna (Bunny Girl)", "img": "asuna_bunny_girl.png", "opts": {"school": ["Millenium"]}}, {"name": "Hibiki (Cheerleader)", "img": "hibiki_cheerleader.png", "opts": {"school": ["Millenium"]}}, {"name": "Karin (Bunny Girl)", "img": "karin_bunny_girl.png", "opts": {"school": ["Millenium"]}}, {"name": "Kotori (Cheerleader)", "img": "kotori_cheerleader.png", "opts": {"school": ["Millenium"]}}, {"name": "Neru (Bunny Girl)", "img": "neru_bunny_girl.png", "opts": {"school": ["Millenium"]}}, {"name": "Toki (Bunny Girl)", "img": "toki_bunny_girl.png", "opts": {"school": ["Millenium"]}}, {"name": "Utaha (Cheerleader)", "img": "utaha_cheerleader.png", "opts": {"school": ["Millenium"]}}, {"name": "Yuuka (Sportswear)", "img": "yuuka_sportswear.png", "opts": {"school": ["Millenium"]}}, {"name": "Yuzu (Maid)", "img": "yuzu_maid.png", "opts": {"school": ["Millenium"]}}, {"name": "Cherino (Hot Spring)", "img": "cherino_hot_spring.png", "opts": {"school": ["RedWinter"]}}, {"name": "Nodoka (Hot Spring)", "img": "nodoka_hot_spring.png", "opts": {"school": ["RedWinter"]}}, {"name": "Shigure (Hot Spring)", "img": "shigure_hot_spring.png", "opts": {"school": ["RedWinter"]}}, {"name": "Saya (Casual)", "img": "saya_casual.png", "opts": {"school": ["Shanhaijing"]}}, {"name": "Shun (Kid)", "img": "shun_kid.png", "opts": {"school": ["Shanhaijing"]}}, {"name": "Miyako (Swimsuit)", "img": "miyako_swimsuit.png", "opts": {"school": ["SRT"]}}, {"name": "Miyu (Swimsuit)", "img": "miyu_swimsuit.png", "opts": {"school": ["SRT"]}}, {"name": "Saki (Swimsuit)", "img": "saki_swimsuit.png", "opts": {"school": ["SRT"]}}, {"name": "Azusa (Swimsuit)", "img": "azusa_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Hanae (Christmas)", "img": "hanae_christmas.png", "opts": {"school": ["Trinity"]}}, {"name": "Hanako (Swimsuit)", "img": "hanako_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Hasumi (Sportswear)", "img": "hasumi_sportswear.png", "opts": {"school": ["Trinity"]}}, {"name": "Hifumi (Swimsuit)", "img": "hifumi_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Hinata (Swimsuit)", "img": "hinata_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Koharu (Swimsuit)", "img": "koharu_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Mari (Sportswear)", "img": "mari_sportswear.png", "opts": {"school": ["Trinity"]}}, {"name": "Mashiro (Swimsuit)", "img": "mashiro_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Serina (Christmas)", "img": "serina_christmas.png", "opts": {"school": ["Trinity"]}}, {"name": "Tsurugi (Swimsuit)", "img": "tsurugi_swimsuit.png", "opts": {"school": ["Trinity"]}}, {"name": "Ui (Swimsuit)", "img": "ui_swimsuit.png", "opts": {"school": ["Trinity"]}}];
	