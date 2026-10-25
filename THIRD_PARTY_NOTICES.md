# Third-party notices

The GitHub Invertocat SVG is the official brand asset from https://brand.github.com/foundations/logo, used for the repository link without altering its paths.

## shadcn/ui et Base UI

Les fichiers `apps/web/src/components/ui/` ont été installés depuis le registre shadcn `base-luma`, avec `shadcn@4.22.1`. Les imports `@base-ui/react/*` confirment le dialecte Base UI. Aucun composant Radix n’est utilisé.

shadcn/ui, copyright (c) 2023 shadcn, licence MIT : https://github.com/shadcn-ui/ui/blob/main/LICENSE.md

Base UI, licence MIT : https://github.com/mui/base-ui/blob/master/LICENSE

## react-colorful

Color picker intégré au Popover Base UI ; API et licence vérifiées dans https://github.com/omgovich/react-colorful. Copyright (c) 2020 Vlad Shilov, MIT. Le package inclut son fichier LICENSE.

## Polices

Source Sans 3 et Space Grotesk sont chargées localement par `@fontsource-variable/*`. Leurs distributions incluent les licences SIL Open Font License. Aucune requête vers Google Fonts au runtime.

## Recherche technique

Le dither Bayer utilise la construction récursive standard de la matrice de seuils ; implementation locale. Référence de méthode : Alex Charlton, https://alex-charlton.com/posts/Dithering_on_the_GPU/.

L’ASCII utilise un atlas rasterisé une fois, puis échantillonné dans le fragment shader ; implementation locale. Référence de méthode : https://github.com/Theovia/ascii-lab. Aucun code de ce dépôt n’est intégré.

## Mediabunny et drag-and-drop

Mediabunny (MPL-2.0), utilisé via sa distribution npm sans modification de ses fichiers : https://github.com/Vanilagy/mediabunny. Le module est chargé à la demande pour les exports vidéo. Son code source et sa licence restent disponibles dans le package.

Le tri de palette utilise les distributions npm MIT de `@dnd-kit/core`, `@dnd-kit/sortable` et `@dnd-kit/utilities` : https://github.com/clauderic/dnd-kit.

Le comportement du dock de variations et le composant Slider reprennent le code du projet local Glyphka (Plinka), conformément à la demande de son propriétaire.

## Compositing reference

The original GLSL color/alpha compositor follows the mathematical definitions in [W3C Compositing and Blending Level 1](https://www.w3.org/TR/compositing-1/). Standard blend modes are checked against native Canvas 2D output; extended blend modes are implemented locally.
