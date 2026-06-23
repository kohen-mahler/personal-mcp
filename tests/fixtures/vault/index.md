---
title: Test Vault Index
status: active
tags:
  - fixture
  - testing
priority: high
---

# Test Vault Index

This is the fixture index file used for integration tests.

## Links Section

- [[Notes/daily]] — daily note wikilink
- [[Folder/]] — folder wikilink
- [[Notes/daily#Morning]] — wikilink with heading
- [[Notes/daily|Today's Note]] — wikilink with alias
- [External Site](https://example.com) — external link
- [Research Paper](https://arxiv.org/pdf/1234.pdf) — external PDF, should be kept
- [Local Doc](local.pdf) — local PDF, should be filtered
- ![Image](photo.png) — image embed, should be filtered

## Body Tags

Some content with #inline-tag and #another/tag here.
Duplicate of frontmatter tag: #fixture

## Code Block

```python
# this #hash should still be extracted (known limitation)
print("hello")
```
