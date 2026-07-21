# Mapeo fuentes Excel → temas UNGRD

Ver modelo de seguimiento y cruces: [DATA-MODEL-ANALYSIS.md](./DATA-MODEL-ANALYSIS.md)

Regenerar campos desde Excel reales en `~/Downloads`:

```bash
node scripts/generate-theme-fields.cjs
npm run db:seed
```

## Matriz (schemaVersion 3)

| Menú | Capas incluidas | Clave de seguimiento | Campos |
|------|-----------------|----------------------|--------|
| **Puentes** | Inventario ArcGIS | ID / lugar | 30 |
| **Obras de Emergencia** | Contrato + O.P. | Contrato / OP | 123 |
| **Obras por impuestos** | Convenio | Nº convenio / BPIN | 31 |
| **Declaratoria** | Decretos | Nº declaratoria | 38 |
| **Banco de Maquinaria** | Inventario + Convenio + Bitácora + Entrega | Serial / máquina / convenio | 72 |
| **Carrotanques** | Maqueta + Bitácora + Suministro | Placa | 43 |
| **Agua y Saneamiento** | Maqueta + Control + Mods + Bitácora + Pagos | Orden de proveeduría | 125 |

Todo registro lleva `tipo_registro`, `capa` y `clave_seguimiento` para análisis y cruce.
