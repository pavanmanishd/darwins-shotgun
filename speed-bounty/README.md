# Speed Bounty: Santa's Speedy Shopper

Five Christmas gifts from real shopping websites, found by OpenClaw with Kimi K3.1 Pro on Cerebras, with TPS measured by the [official speed patch](https://github.com/wkasekende/openclaw-speed-patch). The speed patch and our config are the only changes to OpenClaw; no plugins.

## Setup

```sh
git clone https://github.com/openclaw/openclaw.git && cd openclaw
git checkout 8b18b55
git am openclaw-cerebras-kimi-on-8b18b55.patch      # from the speed patch repo
pnpm install && pnpm build && pnpm ui:build

mkdir -p ~/.openclaw-santa
cp ../speed-bounty/openclaw.example.json ~/.openclaw-santa/openclaw.json
export CEREBRAS_API_KEY=... OPENCLAW_GATEWAY_TOKEN=...
node openclaw.mjs --profile santa gateway           # port 18800
node openclaw.mjs --profile santa dashboard         # opens the web chat with the TPS readout
```

The config:
- Points OpenClaw at `https://api.cerebras.ai/v1` with `moonshotai-kimi-k3.1-pro-trial` and low reasoning effort.
- Gives the agent only `web_search` (DuckDuckGo, no key) and `web_fetch`, with tool search off, so each run is a short sequence of model calls.
- Skips the first-run bootstrap ritual.

## Runs

Start a new chat, paste one prompt, send it once.

| Prompt | What the agent does |
| --- | --- |
| `prompt-web-search.txt` | Picks 5 gift ideas itself and searches the web for them in parallel |
| `prompt-store-search.txt` | Fetches 5 named products live from the stores' public Shopify search JSON in one step |
| `prompt-store-verify.txt` | Same searches, then opens all 5 product pages in parallel to confirm they're live, then lists them |

Our results, all during heavy hackathon load:

| Prompt | Mean | p90 | Model calls |
| --- | --- | --- | --- |
| `prompt-web-search.txt` | 467 tok/s | 530 | 2 |
| `prompt-store-search.txt` | 716 tok/s | 847 | 2 |
| `prompt-store-verify.txt` | **878 tok/s** | 1,406 | 4 |

The `prompt-store-verify.txt` run hit a Cerebras rate-limit error on its last step. We asked the same session to finish step 3, and that call is included in the mean.

TPS is the patch's session readout: the mean of the per-call server decode rates (`time_info.completion_time` and `usage.completion_tokens`).

`edit.py` cuts a run recording into the entry video (60 s max). It fast-forwards queue time, which the server-side TPS doesn't include, and labels it.
