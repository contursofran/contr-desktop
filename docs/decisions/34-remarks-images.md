# 34: Remarks and local images

- A remark's bar and word take theme tokens: Done and Tip `--color-done`, Decision `--color-pr-closed` (the only red one), Warning and Caution `--color-blocked`, Note `--color-working`, Important `--color-pr-merged`, Not verified `--color-dim`.
- Local images come through the `contr-image://local/<absolute path>` scheme in main. It serves only `.png`, `.jpg`, `.jpeg` and `.svg` files; all else is 404. The CSP allows `img-src 'self' contr-image:`. The renderer cannot read other files.
- Only an absolute path alone on its line draws. A web URL, a relative path, another file type or an image inside text shows as a link.
