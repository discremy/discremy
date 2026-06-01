# hello-bot (Discremy example)

Minimal bot to test Discremy with a single slash command: `/hello`.

## Run

From the repository root:

```bash
npm install
```

Then install the example dependencies (it will install `discremy` from npm):

```bash
cd examples/hello-bot
npm install
export DISCORD_TOKEN='your_token'
export DISCORD_CLIENT_ID='your_client_id'
npm start
```

Or run directly:

```bash
node index.js
```
