# Temas operativos — desarrollo autónomo

Cada tema vive en su propia carpeta bajo `src/themes/<slug>/` para que
desarrolladores distintos puedan trabajar en paralelo desde GitHub con PRs acotados.

```text
src/themes/
├── README.md                 ← esta guía
├── index.ts                  ← registro (añadir import al crear tema nuevo)
├── shared/                   ← tipos y buildTheme (núcleo)
│   ├── types.ts
│   ├── buildTheme.ts
│   └── index.ts
├── agua-y-saneamiento/
│   ├── theme.ts
│   ├── index.ts
│   └── README.md
├── carrotanques/
│   └── …
└── …
```

## Flujo recomendado en GitHub

```bash
git checkout -b feat/agua-y-saneamiento-campos-nuevos
# editar solo src/themes/agua-y-saneamiento/**
git add src/themes/agua-y-saneamiento
git commit -m "feat(agua-y-saneamiento): agregar campo X"
git push -u origin HEAD
# abrir PR
```

## Crear un tema nuevo

1. Copie una carpeta existente como plantilla.
2. Cambie `id`, textos y `extraFields` en `theme.ts`.
3. Registre el módulo en `src/themes/index.ts`.
4. Verifique en `/app/temas/<slug>`.

## CODEOWNERS (opcional)

En `.github/CODEOWNERS` puede asignar dueños por carpeta:

```
/src/themes/agua-y-saneamiento/  @dev-agua
/src/themes/carrotanques/        @dev-carrotanques
```
