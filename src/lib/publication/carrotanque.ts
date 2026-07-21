import { db } from "@/db";
import {
  assets,
  legalInstruments,
  locations,
  caseVersions,
} from "@/db/platform-schema";
import { assetCodeFromPayload } from "@/lib/workflow/types";
import { eq } from "drizzle-orm";

/**
 * Publicación transaccional piloto: carrotanque → core.assets + instrumento + ubicación.
 */
export async function publishCarrotanqueCase(params: {
  caseId: string;
  versionId: string;
  payload: Record<string, unknown>;
  userId: string;
}) {
  const assetCode = assetCodeFromPayload(params.payload);
  const placa = String(params.payload.placa || "");
  const departamento = String(params.payload.departamento || "La Guajira");
  const municipio = String(params.payload.municipio || "Riohacha");
  const modalidad = String(params.payload.modalidad || "Comodato");
  const instrumentCode = String(
    params.payload.instrument_code || `COM-${new Date().getFullYear()}-014`,
  );

  return db.transaction(async (tx) => {
    const [loc] = await tx
      .insert(locations)
      .values({
        departamento,
        municipio,
        description: String(params.payload.destino || params.payload.ubicacion || ""),
      })
      .returning();

    const [instrument] = await tx
      .insert(legalInstruments)
      .values({
        instrumentCode,
        instrumentType: modalidad.toUpperCase(),
        title: `Instrumento ${modalidad} — ${placa}`,
        validFrom: new Date().toISOString().slice(0, 10),
        status: "ACTIVE",
        metadata: { caseId: params.caseId },
      })
      .returning();

    const [asset] = await tx
      .insert(assets)
      .values({
        assetCode,
        assetType: "CARROTANQUE",
        name: `Carrotanque ${placa}`,
        status: "OPERATIVE",
        caseId: params.caseId,
        publishedVersionId: params.versionId,
        locationId: loc!.id,
        metadata: {
          placa,
          volumen_m3: params.payload.volumen_m3,
          destino: params.payload.destino,
          valor: params.payload.valor,
        },
      })
      .returning();

    await tx
      .update(caseVersions)
      .set({ status: "PUBLISHED", approvedAt: new Date() })
      .where(eq(caseVersions.id, params.versionId));

    return {
      assetId: asset!.id,
      assetCode: asset!.assetCode,
      instrumentId: instrument!.id,
      instrumentCode: instrument!.instrumentCode,
      locationId: loc!.id,
    };
  });
}
