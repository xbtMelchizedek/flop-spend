# Security

Report vulnerabilities privately through GitHub's **Report a vulnerability** button on this repository (Security tab, then Advisories). Please don't open a public issue.

In scope:
- A way to make `has-spent` answer yes, or the page show spend, for settlements that aren't on chain as reported.
- Markup or script injection from explorer data into the page.
- The CLI or MCP server reading or writing anything beyond the public explorer, RPC and justweight snapshot it is pointed at.

This project holds no keys, signs nothing, makes no payments and only reads public data.
