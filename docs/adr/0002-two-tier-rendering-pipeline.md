# Two-Tier Rendering Pipeline

To prevent browser tabs from running out of memory (crashing) when users drop hundreds of high-resolution camera photos, Framerly creates small downscaled previews (~800px) for the review grid, and only decodes and renders full-resolution files one-by-one in Web Workers during the final ZIP export.
