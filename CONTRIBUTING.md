# Guía de contribución — temas autónomos

## Principio

Cada tema misional de la UNGRD se desarrolla en **su propia carpeta**:

```text
src/themes/<slug>/
```

Así, en GitHub, cada desarrollador abre PRs que solo tocan su tema y se reducen los conflictos.

## Flujo por desarrollador

```bash
git clone https://github.com/PhDRedondo/ungrd-temas-operativos.git
cd ungrd-temas-operativos
npm install
npm run dev

# Trabajar un solo tema
git checkout -b feat/<slug>-mi-cambio
# Editar únicamente src/themes/<slug>/**
git add src/themes/<slug>
git commit -m "feat(<slug>): descripción del cambio"
git push -u origin HEAD
```

Luego abra un Pull Request en GitHub. Active branch protection + CODEOWNERS si desea revisión obligatoria por carpeta.

## Qué sí / qué no

| Sí (en su carpeta) | No (sin acuerdo de núcleo) |
|---|---|
| Campos del formulario (`extraFields`) | Cambiar `src/components/*` |
| Textos, icono, descripciones | Cambiar otros `src/themes/<otro>/` |
| README del tema | Romper contrato de `ThemeConfig` |
| Reglas/demo futuros en su carpeta | Quitar el tema del registro sin PR de arquitectura |

## Crear un tema nuevo

1. Copie `src/themes/agua-y-saneamiento` como plantilla.
2. Renombre la carpeta y ajuste `theme.ts`.
3. Registre el módulo en `src/themes/index.ts`.
4. Actualice `.github/CODEOWNERS` con el owner del tema.
5. PR de arquitectura + tema.

Documentación detallada: [`src/themes/README.md`](src/themes/README.md).
