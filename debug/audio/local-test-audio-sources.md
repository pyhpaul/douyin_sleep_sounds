# Local Test Audio Sources

用途：当前阶段仅用于内部功能测试，验证播放器、场景列表、后端流式读取和前端交互。它们不是最终商用上线素材。

边界：

- 音频文件保存在 `assets/audio/local/`，受 `.gitignore` 保护，不进入 Git。
- 后续接入抖音、广告、会员或正式发布前，需要重新确认最终素材版权、授权截图、下载记录和商用条款。
- `assets/audio/AI音频资产登记表.csv` 仍保留给后续 AI 生成商用候选素材使用，本清单只记录临时内测素材。

## 当前文件

| scene_id | 本地文件 | 来源 | 许可/授权状态 | 用途备注 |
| --- | --- | --- | --- | --- |
| `rain_night` | `assets/audio/local/rain_night.ogg` | https://commons.wikimedia.org/wiki/File:Rain.ogg | Public domain | 雨声音效占位 |
| `ocean_slow` | `assets/audio/local/ocean_slow.ogg` | https://commons.wikimedia.org/wiki/File:Waves.ogg | Public domain | 海浪音效占位 |
| `forest_breeze` | `assets/audio/local/forest_breeze.ogg` | https://commons.wikimedia.org/wiki/File:20090610_0_ambience.ogg | Public domain | 森林环境音占位 |
| `fireplace_room` | `assets/audio/local/fireplace_room.ogg` | https://commons.wikimedia.org/wiki/File:Barbecue.ogg | Public domain | 火焰/壁炉声占位 |
| `creek_soft` | `assets/audio/local/creek_soft.ogg` | https://commons.wikimedia.org/wiki/File:Forest_lawn_creek.ogg | Public domain | 溪流声占位 |
| `soft_wind` | `assets/audio/local/soft_wind.ogg` | https://commons.wikimedia.org/wiki/File:Howling_wind.ogg | CC0 1.0 | 夜风声占位 |
| `nap_white_noise` | `assets/audio/local/nap_white_noise.mp3` | https://soundspool.com/sounds/white-noise3mp3 | CC0 | 白噪音占位 |
| `deep_ambient` | `assets/audio/local/deep_ambient.mp3` | https://ccmixter.org/files/tinyruin/52880 | CC0 | 深夜 ambient 占位 |

## 验证记录

本批文件已做基础文件类型检查：

- `.ogg` 文件识别为 Ogg/Vorbis 音频。
- `.mp3` 文件识别为 MPEG Layer III 音频。
- 后端本地解析规则支持单文件形式：`assets/audio/local/<scene_id>.<ext>`。

上线前不要直接把这批文件当成最终商用音频；最终商用素材应重新走 `masters -> processed -> evidence -> AI音频资产登记表.csv` 的留档流程。
