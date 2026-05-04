const DEMO_AUDIO_URL = "https://sf1-ttcdn-tos.pstatp.com/obj/developer/sdk/0000-0001.mp3";

const soundGroups = [
  {
    id: "nature",
    title: "自然",
    subtitle: "把自然声放慢，留给入睡前的几分钟。",
    sounds: [
      {
        id: "rain",
        title: "雨声",
        category: "自然",
        description: "细密雨声，适合放松和屏蔽环境噪声。",
        url: DEMO_AUDIO_URL,
        cover: ""
      },
      {
        id: "wave",
        title: "海浪",
        category: "自然",
        description: "轻缓海浪声，适合睡前稳定呼吸节奏。",
        url: DEMO_AUDIO_URL,
        cover: ""
      }
    ]
  },
  {
    id: "white-noise",
    title: "白噪音",
    subtitle: "持续、柔和、低干扰的背景声音。",
    sounds: [
      {
        id: "fire",
        title: "篝火",
        category: "白噪音",
        description: "温暖的火焰声，适合夜间阅读后入睡。",
        url: DEMO_AUDIO_URL,
        cover: ""
      },
      {
        id: "wind",
        title: "风声",
        category: "白噪音",
        description: "平稳风声，减少突兀环境声带来的打扰。",
        url: DEMO_AUDIO_URL,
        cover: ""
      }
    ]
  },
  {
    id: "relax",
    title: "放松冥想",
    subtitle: "更轻的旋律和呼吸引导，适合准备入睡。",
    sounds: [
      {
        id: "soft-music",
        title: "轻音乐",
        category: "放松冥想",
        description: "柔和旋律，帮助从工作状态切换到休息状态。",
        url: DEMO_AUDIO_URL,
        cover: ""
      },
      {
        id: "deep-breath",
        title: "深呼吸",
        category: "放松冥想",
        description: "慢节奏呼吸感声音，适合睡前冥想练习。",
        url: DEMO_AUDIO_URL,
        cover: ""
      }
    ]
  }
];

module.exports = {
  soundGroups
};
