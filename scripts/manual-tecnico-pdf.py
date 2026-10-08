#!/usr/bin/env python3
"""Manual técnico SNIGRD — Temas Operativos. Formato institucional GTI."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    ListFlowable,
    ListItem,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "M-1101-GTI-17-Manual-tecnico-temas-operativos.pdf"
LOGO = ROOT / "public" / "branding" / "UNGRD-Vertical.png"

CODIGO = "M-1101-GTI-17"
VERSION = "02"
FECHA = "08/10/2026"
TITULO_L1 = "MANUAL TÉCNICO – SNIGRD – TEMAS"
TITULO_L2 = "OPERATIVOS"
AZUL = colors.HexColor("#002060")
AZUL_TOC = colors.HexColor("#486E9A")
PAGE_W, PAGE_H = letter
PAGE_TOTAL = 0
MARKS = {}


def styles():
    return {
        "h2": ParagraphStyle(
            "h2", fontName="Arial-Bold", fontSize=11, leading=14,
            textColor=colors.black, spaceBefore=10, spaceAfter=4,
        ),
        "h3": ParagraphStyle(
            "h3", fontName="Arial-Bold", fontSize=11, leading=14,
            textColor=colors.black, spaceBefore=8, spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "body", fontName="Arial", fontSize=11, leading=14,
            alignment=TA_JUSTIFY, textColor=colors.black, spaceAfter=8,
        ),
        "toc_title": ParagraphStyle(
            "toc_title", fontName="Arial", fontSize=12, leading=15,
            alignment=TA_CENTER, textColor=AZUL_TOC, spaceBefore=4, spaceAfter=8,
        ),
        "toc_l": ParagraphStyle(
            "toc_l", fontName="Arial", fontSize=11, leading=15, textColor=colors.black,
        ),
        "toc_r": ParagraphStyle(
            "toc_r", fontName="Arial", fontSize=11, leading=15,
            alignment=TA_LEFT, textColor=colors.black,
        ),
        "bar": ParagraphStyle(
            "bar", fontName="Arial-Bold", fontSize=12, leading=15,
            alignment=TA_CENTER, textColor=colors.white,
        ),
        "th": ParagraphStyle(
            "th", fontName="Arial-Bold", fontSize=8, leading=10,
            textColor=colors.white, alignment=TA_CENTER,
        ),
        "td": ParagraphStyle(
            "td", fontName="Arial", fontSize=8, leading=10,
            textColor=colors.black, alignment=TA_CENTER,
        ),
        "small": ParagraphStyle(
            "small", fontName="Arial", fontSize=9, leading=12,
            textColor=colors.black, spaceBefore=8,
        ),
    }


S = styles()


def P(text, style="body"):
    return Paragraph(text, S[style])


def cell(text, header=False):
    return Paragraph(str(text), S["th"] if header else S["td"])


def tabla(headers, rows, widths):
    data = [[cell(h, True) for h in headers]]
    for row in rows:
        data.append([cell(c) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), AZUL),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return t


W = [3.3 * cm, 2.4 * cm, 7.6 * cm, 1.5 * cm, 2.0 * cm]


def dict_rows(rows):
    return tabla(["Campo", "Tipo", "Descripción", "Oblig.", "Clasif."], rows, W)


def bullets(items):
    flow = []
    for item in items:
        flow.append(ListItem(P(item), leftIndent=12, bulletColor=colors.black))
    return ListFlowable(
        flow, bulletType="bullet", start="•", leftIndent=16,
        bulletFontName="Arial", bulletFontSize=11,
    )


def barra(texto):
    usable = 518
    data = [[Paragraph(texto, S["bar"])]]
    t = Table(data, colWidths=[usable])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AZUL),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    t.spaceBefore = 8
    t.spaceAfter = 8
    return t


class Marca(Flowable):
    def __init__(self, clave):
        super().__init__()
        self.clave = clave

    def wrap(self, aw, ah):
        return (0, 0)

    def draw(self):
        MARKS[self.clave] = self.canv.getPageNumber()


def toc_linea(etiqueta, pagina, indent=0):
    estilo = ParagraphStyle(
        "toc_item", fontName="Arial", fontSize=10, leading=13,
        textColor=colors.black, leftIndent=indent,
    )
    puntos = ParagraphStyle(
        "toc_pts", fontName="Arial", fontSize=8, leading=13, textColor=colors.HexColor("#666666"),
    )
    fila = Table(
        [[Paragraph(etiqueta, estilo), Paragraph("." * 28, puntos), Paragraph(str(pagina), S["toc_r"])]],
        colWidths=[13.6 * cm, 3.2 * cm, 1.2 * cm],
    )
    fila.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
    ]))
    return fila


def _centro(c, texto, x0, x1, y, fuente, tam):
    c.setFont(fuente, tam)
    ancho = c.stringWidth(texto, fuente, tam)
    c.drawString((x0 + x1 - ancho) / 2, y, texto)


def dibujar_banner(c, pagina):
    total = PAGE_TOTAL or pagina
    x = [47, 159, 375, 480, 565]
    y_top = PAGE_H - 35
    y_mid = PAGE_H - 62.2
    y_bot = PAGE_H - 91.5
    c.saveState()
    c.setStrokeColor(colors.black)
    c.setFillColor(colors.black)
    c.setLineWidth(0.8)
    c.rect(x[0], y_bot, x[4] - x[0], y_top - y_bot, stroke=1, fill=0)
    c.line(x[1], y_bot, x[1], y_top)
    c.line(x[2], y_bot, x[2], y_top)
    c.line(x[3], y_bot, x[3], y_top)
    c.line(x[1], y_mid, x[4], y_mid)
    if LOGO.exists():
        c.drawImage(
            str(LOGO), x[0] + 8, y_bot + 6,
            width=x[1] - x[0] - 16, height=y_top - y_bot - 12,
            preserveAspectRatio=True, mask="auto", anchor="c",
        )
    c.setFillColor(colors.black)
    _centro(c, TITULO_L1, x[1], x[2], y_mid + 16, "Arial-Bold", 8)
    _centro(c, TITULO_L2, x[1], x[2], y_mid + 6, "Arial-Bold", 8)
    _centro(c, "GESTIÓN DE TECNOLOGÍAS DE LA", x[1], x[2], y_bot + 16, "Arial-Bold", 7.5)
    _centro(c, "INFORMACIÓN", x[1], x[2], y_bot + 6, "Arial-Bold", 7.5)
    _centro(c, "CÓDIGO:", x[2], x[3], y_mid + 16, "Arial-Bold", 8)
    _centro(c, CODIGO, x[2], x[3], y_mid + 6, "Arial", 8)
    _centro(c, f"F.A: {FECHA}", x[2], x[3], y_bot + 10, "Arial", 8)
    _centro(c, f"Versión {VERSION}", x[3], x[4], y_mid + 10, "Arial", 8)
    _centro(c, f"Página {pagina} de", x[3], x[4], y_bot + 16, "Arial", 8)
    _centro(c, str(total), x[3], x[4], y_bot + 6, "Arial", 8)
    c.restoreState()


class ManualDoc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(
            path,
            pagesize=letter,
            title="M-1101-GTI-17  MT TEMAS OPERATIVOS",
            author="Gestión de Tecnologías de la Información — UNGRD",
            subject="Manual técnico de la plataforma Temas Operativos sobre Alibaba Cloud",
        )
        frame = Frame(47, 46, 518, 640, id="body", showBoundary=0)
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self._decor)])

    def _decor(self, canv, doc):
        dibujar_banner(canv, doc.page)


def build():
    story = []
    story.append(P("Tabla de contenido", "toc_title"))
    entradas = [
        ("1. INTRODUCCIÓN", "s1", 0),
        ("2. OBJETIVO", "s2", 0),
        ("3. ALCANCE", "s3", 0),
        ("4. DEFINICIONES", "s4", 0),
        ("5. REQUERIMIENTOS LEGALES Y OTROS REQUISITOS", "s5", 0),
        ("6. DESARROLLO", "s6", 0),
        ("5.1 Gobernanza de Datos", "s61", 12),
        ("5.1.1    Fuentes de datos y caracterización de la información", "s611", 24),
        ("5.1.2    Diccionario de datos y modelo de información", "s612", 24),
        ("5.1.3    Calidad de datos aplicada en las capas Bronce, Silver y Gold", "s613", 24),
        ("5.1.4    Procesos de transformación, trazabilidad y control del dato", "s614", 24),
        ("5.1.5    Bases misionales conectadas", "s615", 24),
        ("5.2 ARQUITECTURA DE LA SOLUCIÓN", "s62", 12),
        ("5.2.1    Arquitectura general de la solución", "s621", 24),
        ("5.2.2    Componentes tecnológicos e infraestructura", "s622", 24),
        ("5.3 Lineamientos técnicos de seguridad, operación y escalabilidad", "s63", 12),
        ("7. CONTROL DE CAMBIOS DEL DOCUMENTO", "s7", 0),
    ]
    for etiqueta, clave, indent in entradas:
        story.append(toc_linea(etiqueta, MARKS.get(clave, ""), indent))
    story.append(Spacer(1, 10))

    story.append(Marca("s1"))
    story.append(barra("1. INTRODUCCIÓN"))
    story.append(P(
        "El presente manual técnico documenta la plataforma <b>Temas Operativos</b> del Sistema "
        "Nacional de Información para la Gestión del Riesgo de Desastres (SNIGRD), operada por la "
        "Unidad Nacional para la Gestión del Riesgo de Desastres (UNGRD). La solución concentra la "
        "captura, la carga masiva, la custodia y la lectura analítica de las bases misionales de la "
        "Subdirección para el Manejo de Desastres sobre <b>Alibaba Cloud</b>."
    ))
    story.append(P(
        "La base de datos es una única instancia de <b>PostgreSQL 18 en RDS de Alibaba Cloud</b>. "
        "La aplicación, el entorno de trabajo y Quick BI leen esa misma instancia. El host no admite "
        "SSL: la cadena de conexión usa <font face='Courier'>sslmode=disable</font> "
        "(<font face='Courier'>ssl=false</font> en JDBC). Los archivos de carga se registran en la "
        "base y su binario se conserva en el almacenamiento de objetos de Alibaba Cloud (OSS) cuando "
        "la aplicación corre con más de una réplica; en un solo nodo el binario vive en el volumen "
        "persistente de la instancia."
    ))
    story.append(P(
        "El modelo de información no crea una base por tema. Todas las bases misionales conviven en "
        "<font face='Courier'>public.records</font>, separadas por <font face='Courier'>theme_id</font> "
        "y por la capa de negocio guardada en <font face='Courier'>payload</font>. Sobre esa tabla se "
        "construye el contrato de lectura Medallón: vistas Bronce, vistas por tema y capa, y tablas "
        "Silver relacionales para los temas que ya tienen modelo físico. Quick BI consume esas vistas "
        "y tablas, no hojas sueltas."
    ))
    story.append(P(
        "Este documento describe la gobernanza del dato, el diccionario de la estructura común, las "
        "conexiones y los componentes de infraestructura. No sustituye el manual funcional de cada "
        "línea misional ni los procedimientos administrativos del área."
    ))

    story.append(Marca("s2"))
    story.append(barra("2. OBJETIVO"))
    story.append(P(
        "Documentar la solución técnica de Temas Operativos sobre Alibaba Cloud, de modo que el "
        "personal de la Gestión de Tecnologías de la Información pueda administrar, soportar, "
        "operar y evolucionar la plataforma. El manual fija la fuente de verdad, el modelo de "
        "tablas, las reglas de calidad, las conexiones a RDS y Quick BI, y los lineamientos de "
        "seguridad y continuidad."
    ))

    story.append(Marca("s3"))
    story.append(barra("3. ALCANCE"))
    story.append(P("Este manual cubre:"))
    story.append(bullets([
        "La instancia PostgreSQL de RDS Alibaba: motor, host, puerto, base, usuario de aplicación y modo SSL.",
        "El esquema operativo <font face='Courier'>public</font>: catálogo de temas, registros, versiones, cargas, auditoría y control de acceso.",
        "El contrato Medallón en la misma instancia: esquemas <font face='Courier'>medallion</font>, vistas por tema, <font face='Courier'>silver_agua</font> y <font face='Courier'>silver_puentes</font>.",
        "Los esquemas de plataforma <font face='Courier'>iam</font>, <font face='Courier'>config</font>, <font face='Courier'>staging</font>, <font face='Courier'>workflow</font>, <font face='Courier'>core</font> y <font face='Courier'>audit</font>.",
        "La aplicación (Next.js) que expone la API REST, la captura, la carga Excel y el mapa, empaquetada para ejecutarse en Alibaba Cloud.",
        "La conexión de Quick BI a la misma instancia y el servicio de embed de tableros.",
        "Las reglas de calidad, trazabilidad, seguridad y operación.",
    ]))
    story.append(P(
        "No cubre el procedimiento funcional de cada línea (cómo se diligencia una orden de "
        "proveeduría, un CDP o un convenio), ni la mesa de ayuda, ni las políticas generales de "
        "seguridad de la UNGRD distintas de las que aplica esta plataforma."
    ))

    story.append(Marca("s4"))
    story.append(barra("4. DEFINICIONES"))
    defs = [
        ("Activo de información", "Recursos tecnológicos, infraestructura y datos de la plataforma. La instancia RDS, los esquemas, las cargas Excel y las cuentas de acceso son activos de la UNGRD."),
        ("ACL", "Lista de control de acceso por tema (<font face='Courier'>public.user_theme_access</font>). En producción, <font face='Courier'>ACL_STRICT=true</font>: quien no tiene fila de acceso no entra al tema."),
        ("API REST", "Interfaz HTTP de la aplicación bajo <font face='Courier'>/api</font>. Es el único camino de escritura de negocio. Quick BI no escribe en las tablas operativas."),
        ("Arquitectura Medallón", "Organización Bronce, Silver y Gold sobre la misma instancia PostgreSQL. Bronce conserva el dato operativo con filtro de calidad; Silver materializa tablas por hoja; Gold es la lectura que publica indicadores en Quick BI."),
        ("Bronce", "Vistas de lectura que exponen <font face='Courier'>public.records</font> y el catálogo de temas sin inventar columnas de otro tema. Excluyen borrados lógicos y fuentes de prueba."),
        ("Capa", "Tipo de fila dentro de un tema (maqueta, bitácora, seguimiento, transferencia, entre otras). Viaja en el payload y en las vistas por hoja."),
        ("Clave de seguimiento", "Identificador de cruce del registro dentro del tema: orden de proveeduría, CDP, placa, serial, convenio o clave de proceso, según la base."),
        ("Content hash", "Huella del contenido del registro. Junto con <font face='Courier'>theme_id</font> impide insertar dos veces el mismo contenido (índice único)."),
        ("DIVIPOLA", "División político-administrativa oficial del DANE. Departamento y municipio de cada registro se validan contra ese catálogo. No se inventan municipios."),
        ("Gold", "Conjunto de vistas y tablas que Quick BI usa para indicadores. En esta plataforma vive en la misma instancia RDS, no en un motor aparte."),
        ("Idempotencia", "Volver a cargar el mismo archivo no duplica filas vivas: el hash de contenido y la clave de negocio deciden si el registro se actualiza o se rechaza como duplicado."),
        ("Payload", "Documento JSON con los campos propios del tema. Las columnas fijas de <font face='Courier'>public.records</font> no cambian de un tema a otro; lo específico va en <font face='Courier'>payload</font>."),
        ("Quick BI", "Servicio de visualización de Alibaba Cloud. Se conecta por JDBC a la misma instancia RDS, con SSL desactivado."),
        ("RDS", "Relational Database Service de Alibaba Cloud. Aloja la única base operativa de la plataforma."),
        ("Registro", "Fila de negocio en <font face='Courier'>public.records</font>. Puede originarse en un formulario (<font face='Courier'>source=form</font>) o en Excel (<font face='Courier'>source=excel</font>)."),
        ("Silver", "Tablas físicas con llave primaria y foránea, generadas desde las vistas Bronce. Hoy existen para Agua (<font face='Courier'>silver_agua</font>) y Puentes (<font face='Courier'>silver_puentes</font>)."),
        ("Soft delete", "Borrado lógico. <font face='Courier'>deleted_at</font> deja de publicar el registro en Bronce y Silver sin destruir la fila ni su historial."),
        ("Tema", "Módulo misional. Su definición (campos, capas y clave) vive en el código del tema y se sincroniza al catálogo <font face='Courier'>public.themes</font>."),
        ("OSS", "Object Storage Service de Alibaba Cloud. Destino de los archivos Excel cuando la aplicación tiene más de una réplica. El metadato de la carga permanece en <font face='Courier'>public.uploads</font>."),
    ]
    for name, text in defs:
        story.append(P(f"<b>{name}.</b> {text}"))

    story.append(Marca("s5"))
    story.append(barra("5. REQUERIMIENTOS LEGALES Y OTROS REQUISITOS"))
    story.append(P(
        "La plataforma custodia información de la gestión del riesgo de desastres y datos de "
        "terceros asociados a contratos, órdenes y territorio. Su operación se ajusta, en lo "
        "técnico, a los siguientes marcos. Este apartado no reemplaza el concepto jurídico del área competente."
    ))
    story.append(tabla(
        ["Referencia", "Aplicación en la plataforma"],
        [
            ["Ley 1523 de 2012", "Sistema Nacional de Gestión del Riesgo de Desastres. La plataforma es un activo de información de la UNGRD para el manejo de desastres."],
            ["Ley 1712 de 2014", "Transparencia y acceso a la información. Los indicadores de carácter público se publican por los tableros; el detalle contractual permanece clasificado como interno."],
            ["Ley 1581 de 2012 y Decreto 1377 de 2013", "Protección de datos personales. NIT, nombres de proveedor y datos de contacto no se exponen en vistas marcadas como públicas. El acceso es por rol y por tema."],
            ["Ley 1273 de 2009", "Delitos informáticos. Las credenciales de RDS, Quick BI y el secreto de sesión no se almacenan en el repositorio."],
            ["DIVIPOLA / MGN, DANE", "Georreferenciación oficial. El mapa y los filtros territoriales usan el catálogo DANE embebido en la aplicación. No hay geometría inventada."],
            ["Clasificación interna UNGRD", "Cada campo del diccionario declara clasificación Público o Interno. Lo interno no se publica en tableros de acceso amplio."],
        ],
        [4.4 * cm, 12.4 * cm],
    ))
    story.append(Spacer(1, 8))

    story.append(Marca("s6"))
    story.append(barra("6. DESARROLLO"))
    story.append(Marca("s61"))
    story.append(P("5.1 GOBERNANZA DE DATOS", "h2"))
    story.append(Marca("s611"))
    story.append(P("FUENTES DE DATOS Y CARACTERIZACIÓN DE LA INFORMACIÓN", "h3"))
    story.append(P(
        "Hay dos puertas de entrada y una sola tabla de destino. El formulario de captura escribe "
        "un registro con <font face='Courier'>source = form</font>. La carga Excel valida el archivo, "
        "deja constancia en <font face='Courier'>public.uploads</font> y escribe o actualiza registros "
        "con <font face='Courier'>source = excel</font>. Ninguna fuente externa escribe directo en RDS: "
        "pasa por la API."
    ))
    story.append(tabla(
        ["Fuente", "Destino", "Regla de entrada"],
        [
            ["Formulario del tema", "public.records", "Esquema del tema (campos, obligatorios y tipos). Geo contra DIVIPOLA."],
            ["Archivo Excel del tema", "public.uploads + public.records", "Validación previa sin guardar; luego upsert por clave y hash. Rechazos quedan en uploads.errors."],
            ["Catálogo de temas", "public.themes", "Sincronización desde la definición del módulo. field_schema describe las columnas lógicas."],
            ["Lectura analítica", "Vistas Bronce, vistas por capa y tablas Silver", "Solo filas vivas (deleted_at nulo) y fuentes reales (form, excel)."],
        ],
        [4.2 * cm, 5.2 * cm, 7.4 * cm],
    ))
    story.append(Spacer(1, 6))
    story.append(P(
        "El catálogo de bases (temas) comparte la misma estructura de custodia. Cambia la clave de "
        "negocio y las hojas, no la tabla madre."
    ))
    story.append(tabla(
        ["Tema (theme_id)", "Clave de negocio", "Capas o lectura principal"],
        [
            ["agua-y-saneamiento", "orden_de_proveeduria", "Hojas Excel; Silver en silver_agua"],
            ["puentes", "clave_proceso / contrato", "Estructuración, inventario, bitácora; Silver en silver_puentes"],
            ["fic", "record_id (no no_cdp)", "Transferencia, legalización, prórroga; vista fic.fic"],
            ["ejecucion-financiera", "CDP del corte", "Pestaña SMD del reporte; cupo manual por línea"],
            ["obras-de-emergencia", "clave_seguimiento", "Contrato, orden de proveeduría, seguimiento"],
            ["obras-por-impuestos", "convenio", "Convenio, interventoría, seguimiento"],
            ["carrotanques", "placa", "Maqueta, bitácora, suministro"],
            ["banco-de-maquinaria", "convenio y serial", "Convenio raíz y detalle por serial"],
            ["subsidios-de-arriendos", "uuid de envío", "Consolidado de envíos"],
            ["presupuesto", "rubro + vigencia", "Asignación por rubro. Sin capas adicionales."],
        ],
        [5.2 * cm, 4.2 * cm, 7.4 * cm],
    ))
    story.append(P(
        "Las diez bases de esta tabla ya están conectadas a <font face='Courier'>public.records</font> "
        "y, donde existe contrato de lectura, a una vista o esquema Medallón. El detalle de capas, "
        "llaves y tablas está en el numeral 5.1.5. Los demás temas del catálogo comparten la misma "
        "tabla madre, pero este manual no los desarrolla."
    ))
    story.append(Spacer(1, 8))

    story.append(Marca("s612"))
    story.append(P("DICCIONARIO DE DATOS Y MODELO DE INFORMACIÓN", "h3"))
    story.append(P(
        "La instancia se llama <font face='Courier'>d01_p011_aplicativo_temas</font>. El diccionario "
        "de abajo es el de la estructura común. Los campos de cada hoja Excel no se listan aquí: "
        "están en <font face='Courier'>public.themes.field_schema</font> y se proyectan como columnas "
        "en las vistas del tema (<font face='Courier'>agua.*</font>, <font face='Courier'>puentes.*</font>, "
        "<font face='Courier'>fic.fic</font> y las demás generadas por el contrato Medallón)."
    ))
    story.append(P("<b>public.themes</b> — catálogo de bases.", "body"))
    story.append(dict_rows([
        ["id", "text", "Identificador del tema. Llave primaria. Coincide con la carpeta del módulo.", "Sí", "Interno"],
        ["name", "text", "Nombre visible del tema.", "Sí", "Público"],
        ["short_name", "text", "Nombre corto para tableros y menú.", "Sí", "Público"],
        ["description", "text", "Descripción del módulo.", "No", "Público"],
        ["unit", "text", "Unidad de medida del valor, si aplica.", "No", "Público"],
        ["value_label", "text", "Etiqueta del valor monetario o de cantidad.", "Sí", "Público"],
        ["schema_version", "integer", "Versión del formulario. La carga Excel debe coincidir con esta versión.", "Sí", "Interno"],
        ["field_schema", "jsonb", "Lista de campos: nombre, etiqueta, tipo y si es obligatorio.", "Sí", "Interno"],
        ["updated_at", "timestamptz", "Última sincronización del catálogo.", "Sí", "Interno"],
    ]))
    story.append(Spacer(1, 6))
    story.append(P("<b>public.records</b> — registros operativos. Una fila por hecho de negocio.", "body"))
    story.append(dict_rows([
        ["id", "uuid", "Llave primaria técnica. En las vistas analíticas se publica como record_id.", "Sí", "Interno"],
        ["theme_id", "text", "Tema dueño. Llave foránea a public.themes.", "Sí", "Interno"],
        ["departamento", "text", "Departamento DIVIPOLA canónico.", "Sí", "Público"],
        ["municipio", "text", "Municipio DIVIPOLA canónico.", "Sí", "Público"],
        ["fecha", "date", "Fecha de referencia del registro.", "Sí", "Interno"],
        ["estado", "text", "Estado operativo del registro.", "Sí", "Interno"],
        ["valor", "numeric(18,2)", "Valor numérico de cabecera. El detalle monetario del tema puede vivir además en payload.", "Sí", "Interno"],
        ["payload", "jsonb", "Campos propios del tema y de la capa. No se promueven a columnas fijas.", "Sí", "Interno"],
        ["source", "text", "Origen: form o excel. Las fuentes seed, demo, harness, smoke y test no entran a Bronce.", "Sí", "Interno"],
        ["content_hash", "text", "Huella del contenido. Única junto con theme_id.", "Sí", "Interno"],
        ["upload_id", "uuid", "Carga Excel que originó la fila, si aplica.", "No", "Interno"],
        ["created_by", "uuid", "Usuario que creó el registro.", "No", "Interno"],
        ["created_at", "timestamptz", "Alta.", "Sí", "Interno"],
        ["updated_at", "timestamptz", "Última modificación.", "Sí", "Interno"],
        ["deleted_at", "timestamptz", "Borrado lógico. Nulo significa registro vivo.", "No", "Interno"],
    ]))
    story.append(Spacer(1, 6))
    story.append(P("<b>public.uploads</b> — constancia de cada archivo Excel.", "body"))
    story.append(dict_rows([
        ["id", "uuid", "Llave primaria de la carga.", "Sí", "Interno"],
        ["theme_id", "text", "Tema al que pertenece el archivo.", "Sí", "Interno"],
        ["schema_version", "integer", "Versión de formulario con la que se validó.", "Sí", "Interno"],
        ["file_name", "text", "Nombre original del archivo.", "Sí", "Interno"],
        ["storage_path", "text", "Ruta del binario en el volumen de la instancia o en OSS.", "No", "Interno"],
        ["status", "text", "Estado de la carga (pending y estados de cierre).", "Sí", "Interno"],
        ["accepted", "integer", "Filas aceptadas.", "Sí", "Interno"],
        ["rejected", "integer", "Filas rechazadas por validación.", "Sí", "Interno"],
        ["duplicates", "integer", "Filas ya presentes según hash o clave.", "Sí", "Interno"],
        ["errors", "jsonb", "Detalle de rechazos. No se pierden al cerrar la carga.", "No", "Interno"],
        ["created_by", "uuid", "Usuario que cargó el archivo.", "No", "Interno"],
        ["created_at", "timestamptz", "Inicio.", "Sí", "Interno"],
        ["finished_at", "timestamptz", "Cierre.", "No", "Interno"],
    ]))
    story.append(Spacer(1, 6))
    story.append(P("<b>public.record_versions</b> — historial. Restaurar no borra versiones: agrega una nueva.", "body"))
    story.append(dict_rows([
        ["id", "uuid", "Llave primaria de la versión.", "Sí", "Interno"],
        ["record_id", "uuid", "Registro versionado.", "Sí", "Interno"],
        ["theme_id", "text", "Tema, desnormalizado para consulta.", "Sí", "Interno"],
        ["version", "integer", "Número de versión. Único por record_id.", "Sí", "Interno"],
        ["departamento, municipio, fecha, estado, valor, payload", "mixto", "Copia del registro en ese momento.", "Sí", "Interno"],
        ["changed_fields", "jsonb", "Nombres de campos que cambiaron.", "No", "Interno"],
        ["reason", "text", "Motivo declarado de la edición.", "No", "Interno"],
        ["created_by", "uuid", "Quién generó la versión.", "No", "Interno"],
        ["created_at", "timestamptz", "Cuándo.", "Sí", "Interno"],
    ]))
    story.append(Spacer(1, 6))
    story.append(P("<b>public.users</b>, <b>public.user_theme_access</b> y <b>public.audit_log</b>.", "body"))
    story.append(dict_rows([
        ["users.id", "uuid", "Identificador local del usuario.", "Sí", "Interno"],
        ["users.keycloak_sub", "text", "Sujeto del proveedor de identidad, cuando AUTH_MODE=keycloak.", "Sí", "Interno"],
        ["users.email", "text", "Correo. Único.", "Sí", "Interno"],
        ["users.role", "text", "Rol de aplicación. admin y subdirector ven todos los temas.", "Sí", "Interno"],
        ["user_theme_access.user_id", "uuid", "Usuario.", "Sí", "Interno"],
        ["user_theme_access.theme_id", "text", "Tema autorizado.", "Sí", "Interno"],
        ["user_theme_access.can_read / can_write", "integer", "1 permite, 0 niega. Par único por usuario y tema.", "Sí", "Interno"],
        ["audit_log.action", "text", "Acción registrada.", "Sí", "Interno"],
        ["audit_log.entity / entity_id", "text", "Objeto afectado.", "Sí", "Interno"],
        ["audit_log.before / after", "jsonb", "Estado anterior y posterior.", "No", "Interno"],
        ["audit_log.at", "timestamptz", "Momento del evento.", "Sí", "Interno"],
    ]))
    story.append(Spacer(1, 6))
    story.append(P(
        "<b>Contrato de lectura.</b> El esquema <font face='Courier'>medallion</font> publica "
        "<font face='Courier'>v_bronze_themes</font>, <font face='Courier'>v_bronze_theme_fields</font> "
        "y <font face='Courier'>v_bronze_records</font> (envelope fijo más <font face='Courier'>payload</font>). "
        "Las vistas por hoja (<font face='Courier'>agua.general</font>, <font face='Courier'>puentes.bitacora</font>, "
        "<font face='Courier'>fic.fic</font>, entre otras) aplanan el payload a columnas con el nombre del "
        "campo. <font face='Courier'>medallion.v_fic_all</font> es alias de <font face='Courier'>fic.fic</font>. "
        "Quick BI debe usar la vista de la hoja, no unir por un código de negocio que no es llave "
        "(en FIC la llave de tablero es <font face='Courier'>record_id</font>)."
    ))
    story.append(P(
        "<b>Silver.</b> <font face='Courier'>silver_agua.orden</font> es la dimensión de la orden de "
        "proveeduría. Cada hoja de Agua es una tabla con <font face='Courier'>record_id</font> como "
        "llave primaria y la orden como llave foránea. <font face='Courier'>silver_puentes</font> sigue "
        "el mismo patrón para base general, bitácora y estructuración. La sincronización reemplaza el "
        "contenido Silver desde Bronce; no edita <font face='Courier'>public.records</font>."
    ))
    story.append(P(
        "<b>Plataforma.</b> Los esquemas <font face='Courier'>iam</font>, <font face='Courier'>config</font>, "
        "<font face='Courier'>staging</font>, <font face='Courier'>workflow</font>, <font face='Courier'>core</font> "
        "y <font face='Courier'>audit</font> soportan casos, tareas y flujo. No reemplazan "
        "<font face='Courier'>public.records</font>, que sigue siendo la fuente de las bases misionales."
    ))

    story.append(Marca("s613"))
    story.append(P("CALIDAD DE DATOS APLICADA EN LAS CAPAS BRONCE, SILVER Y GOLD", "h3"))
    story.append(P(
        "La calidad no se aplica igual en cada capa. Bronce no reescribe el hecho: lo filtra. "
        "Silver tipa y relaciona. Gold, entendido como la lectura de Quick BI, solo ve lo que "
        "Bronce y Silver ya dejaron pasar."
    ))
    story.append(tabla(
        ["Capa", "Objetivo", "Controles"],
        [
            ["Operativo (public.records)", "Recibir el hecho una sola vez", "Esquema Zod del tema; DIVIPOLA; hash único por tema; conteo de aceptados, rechazados y duplicados en la carga."],
            ["Bronce", "Publicar el dato vivo y real", "deleted_at nulo. source distinto de seed, demo, harness, smoke y test. Sin columnas de otro tema."],
            ["Silver", "Relacionar hojas con llaves", "record_id como PK. Llave de negocio como FK. Sincronización completa desde Bronce, idempotente."],
            ["Gold / Quick BI", "Indicadores estables", "Datasets sobre vistas o tablas Silver. No sobre el JSON crudo, salvo el bronze de auditoría."],
        ],
        [3.6 * cm, 4.2 * cm, 9.0 * cm],
    ))
    story.append(Spacer(1, 6))
    story.append(tabla(
        ["Atributo", "Descripción", "Cómo se verifica"],
        [
            ["Completitud", "Los obligatorios del field_schema y la cabecera del registro vienen llenos.", "El formulario y el Excel rechazan la fila. El rechazo queda en uploads.errors."],
            ["Validez", "Tipos, fechas y territorio pertenecen al dominio.", "Zod en la carga. Departamento y municipio contra DIVIPOLA. Valor numérico en numeric(18,2)."],
            ["Unicidad", "El mismo contenido no se inserta dos veces en el tema.", "Índice único (theme_id, content_hash)."],
            ["Consistencia", "La capa y la clave de negocio coinciden con la definición del tema.", "La vista de la hoja solo proyecta los campos de esa hoja. Silver exige la FK de la llave."],
            ["Trazabilidad", "Se sabe quién cambió qué y desde qué archivo.", "record_versions, audit_log y upload_id."],
            ["Vigencia", "Lo borrado no aparece en tableros.", "Filtro deleted_at IS NULL en Bronce y, por tanto, en Silver."],
        ],
        [3.2 * cm, 6.2 * cm, 7.4 * cm],
    ))
    story.append(Spacer(1, 8))

    story.append(Marca("s614"))
    story.append(P("PROCESOS DE TRANSFORMACIÓN, TRAZABILIDAD Y CONTROL DEL DATO", "h3"))
    story.append(P(
        "El flujo es lineal. No hay un motor de orquestación distinto de la aplicación y de los "
        "scripts de sincronización que corren contra el RDS."
    ))
    story.append(bullets([
        "<b>1. Entrada.</b> El usuario autenticado envía un formulario o un Excel a la API del tema.",
        "<b>2. Validación.</b> Se puede validar el Excel sin escribir. Si se confirma la carga, cada fila pasa el esquema y DIVIPOLA.",
        "<b>3. Custodia.</b> La fila válida se inserta o actualiza en public.records. El archivo queda en public.uploads con su ruta de almacenamiento.",
        "<b>4. Historial.</b> Una edición guarda snapshot en public.record_versions y el evento en public.audit_log.",
        "<b>5. Lectura Bronce.</b> Las vistas medallion y las vistas por hoja proyectan solo filas vivas y fuentes reales.",
        "<b>6. Silver.</b> El comando de sincronización reconstruye silver_agua y silver_puentes desde esas vistas. No modifica la tabla operativa.",
        "<b>7. Consumo.</b> Quick BI lee las vistas o el Silver por JDBC. El embed del tablero en la aplicación pide un ticket al servicio de Quick BI; no copia los datos a otro almacén.",
    ]))
    story.append(P(
        "El control operativo de una carga se lee en <font face='Courier'>accepted</font>, "
        "<font face='Courier'>rejected</font>, <font face='Courier'>duplicates</font> y "
        "<font face='Courier'>errors</font>. Una fila rechazada no entra a Bronce. Una fila "
        "duplicada no crea un segundo <font face='Courier'>id</font>."
    ))

    story.append(Marca("s615"))
    story.append(P("BASES MISIONALES CONECTADAS", "h3"))
    story.append(P(
        "Cada base es un <font face='Courier'>theme_id</font>. Todas escriben en "
        "<font face='Courier'>public.records</font>. La capa va en el payload y la vista Medallón "
        "la convierte en columnas. La llave de negocio no sustituye a <font face='Courier'>record_id</font>: "
        "es el cruce entre hojas del mismo tema."
    ))

    def base(titulo, texto, filas):
        story.append(P(titulo, "h3"))
        story.append(P(texto))
        story.append(tabla(
            ["Capa o formulario", "Modo", "Llave", "Lectura en RDS"],
            filas,
            [4.6 * cm, 2.6 * cm, 4.2 * cm, 5.4 * cm],
        ))
        story.append(Spacer(1, 4))

    base(
        "Agua y saneamiento",
        "Identificador <font face='Courier'>agua-y-saneamiento</font>, versión de esquema 7, ruta "
        "<font face='Courier'>/app/temas/agua-y-saneamiento</font>. Todas las hojas se unen por "
        "<font face='Courier'>orden_de_proveeduria</font>. El hub es <font face='Courier'>agua.general</font>. "
        "No se cruza con el esquema <font face='Courier'>puentes</font>. El mapa de uniones está en "
        "<font face='Courier'>medallion.v_join_map</font> con <font face='Courier'>schema_name = agua</font>. "
        "Bitácora, pagos, modificaciones y estructuración son historial: cada evento nuevo actualiza "
        "la fila de alta con el último estado y deja el detalle en su tabla. Los días de la maqueta "
        "(columnas de permanencia por dependencia) se calculan; no se digitan.",
        [
            ["Alta / registro inicial", "Alta única", "orden_de_proveeduria", "agua.general"],
            ["Variables del líder", "Actualización", "orden_de_proveeduria", "agua.variables_lider"],
            ["Modificaciones", "Historial", "orden_de_proveeduria", "agua.modificaciones"],
            ["Bitácora", "Historial", "orden_de_proveeduria", "agua.bitacora"],
            ["Pagos", "Historial", "orden_de_proveeduria", "agua.pagos"],
            ["CDP y RC", "Historial", "orden_de_proveeduria", "agua.cdps_y_rc"],
            ["Bitácora estructuración", "Historial", "orden_de_proveeduria", "agua.bitacora_estructuracion"],
            ["Control ejecución física", "Actualización", "orden_de_proveeduria", "agua.control_y_seguimiento_detalle_m"],
            ["Silver relacional", "Sincronización", "orden_de_proveeduria", "silver_agua.orden y una tabla por hoja"],
        ],
    )
    base(
        "Carrotanques",
        "Identificador <font face='Courier'>carrotanques</font>, versión 5. La llave es "
        "<font face='Courier'>placa</font>, guardada también como <font face='Courier'>clave_seguimiento</font>. "
        "Las columnas B a J de la maqueta (placa, clase, marca, serial, año, capacidad) no cambian después del alta. "
        "K y L (categorías y propiedad) sí se editan sobre la misma fila. La bitácora actualiza ubicación y estado. "
        "El suministro suma litros, personas y comunidades de todos los viajes de esa placa.",
        [
            ["Alta maqueta", "Alta única", "placa", "Fila de inventario en public.records"],
            ["Actualizar categorías", "Actualización versionada", "placa", "Misma fila de la maqueta, columnas K–L"],
            ["Bitácora estado", "Historial", "placa", "Último evento copia geo y estado a la maqueta"],
            ["Suministro / viajes", "Historial", "placa", "Suma de litros, personas y comunidades"],
        ],
    )
    base(
        "Obras de emergencia",
        "Identificador <font face='Courier'>obras-de-emergencia</font>. Dos hechos de negocio conviven en el tema: "
        "el contrato de obra y la orden de proveeduría de maquinaria. La clave de seguimiento es "
        "<font face='Courier'>contrato_de_obra</font> o <font face='Courier'>orden_de_proveeduria</font>. "
        "El Excel oficial no se recorta: los formularios muestran el subconjunto operativo. "
        "SPI, CPI e IRP se calculan por contrato en <font face='Courier'>calculations.ts</font> y alimentan el tablero.",
        [
            ["Contrato de obra", "Actualización", "contrato_de_obra", "public.records, capa de contrato"],
            ["Orden de proveeduría", "Actualización", "orden_de_proveeduria", "public.records, capa de O.P."],
            ["Seguimiento de avances", "Actualización con búsqueda", "contrato existente", "Estado y avances del contrato"],
        ],
    )
    base(
        "Obras por impuestos",
        "Identificador <font face='Courier'>obras-por-impuestos</font>. La llave es "
        "<font face='Courier'>no_convenio</font>, guardada como <font face='Courier'>clave_seguimiento</font>. "
        "Interventoría y seguimiento buscan un convenio ya creado. Los indicadores reutilizan SPI, CPI e IRP "
        "con las fechas del convenio.",
        [
            ["Convenio", "Actualización", "no_convenio", "public.records, capa de convenio"],
            ["Interventoría", "Actualización con búsqueda", "no_convenio", "Datos de interventoría del mismo convenio"],
            ["Seguimiento", "Actualización con búsqueda", "no_convenio", "Estado y fechas del convenio"],
        ],
    )
    base(
        "Puentes",
        "Identificador <font face='Courier'>puentes</font>, versión 5. El orden de alimentación es obligatorio: "
        "primero nace el proceso, después el puente y después sus eventos. "
        "<font face='Courier'>contrato_convenio</font> solo se escribe en estructuración. En inventario y bitácora "
        "llega heredado; la API rechaza un inventario con contrato inexistente y no deja cambiar el contrato fuera "
        "de la primera capa. No se cruza con el esquema <font face='Courier'>agua</font>.",
        [
            ["Contrato estructuración", "Historial por etapa", "clave_proceso", "puentes.contratos_estructuracion"],
            ["Inventario puente", "Alta única", "id_puente", "puentes.base_general_puentes"],
            ["Bitácora estado", "Historial por evento", "id_puente + convenio_o_cto", "puentes.bitacora"],
            ["Silver relacional", "Sincronización", "id_puente y clave_proceso", "silver_puentes.*"],
        ],
    )
    story.append(P(
        "Uniones de Puentes: bitácora con inventario por <font face='Courier'>id_puente</font> "
        "(alternativa <font face='Courier'>codigo_operativo</font>); inventario con estructuración por "
        "<font face='Courier'>clave_proceso</font> (alternativa <font face='Courier'>contrato_convenio</font>). "
        "El buscador filtra en este orden: contrato, origen, departamento, municipio, tipo, configuración y ubicación."
    ))
    base(
        "Banco de maquinaria",
        "Identificador <font face='Courier'>banco-de-maquinaria</font>, versión 6. El modelo sigue el de Puentes: "
        "el convenio es la raíz y cada máquina cuelga de él por serial. La bitácora del convenio copia el último "
        "estado a los equipos. Departamento y municipio se heredan del convenio y no se pisan desde la bitácora.",
        [
            ["Convenio o proceso", "Alta única", "no_convenio", "Hoja CONVENIOS O PROCESOS"],
            ["Detalle maquinaria", "Alta por equipo", "serial", "Hoja DETALLE MAQUINARIA; exige el convenio"],
            ["Bitácora convenio", "Historial", "no_convenio", "Hoja BITACORA CONVENIOS"],
        ],
    )
    base(
        "FIC",
        "Identificador <font face='Courier'>fic</font>, versión 4. La fuente es el control de transferencias "
        "(AppSheet y el Excel histórico de seguimiento). La capa no se elige a mano: sale de la vigencia "
        "(Transferencia FIC 2014 a 2026). La llave de seguimiento es el número FIC "
        "(<font face='Courier'>no_cdp</font>). <font face='Courier'>id_transferencia</font> separa duplicados. "
        "En Quick BI la llave de la fila es <font face='Courier'>record_id</font>, no el número de CDP. "
        "La vista de lectura es <font face='Courier'>fic.fic</font> (alias <font face='Courier'>medallion.v_fic_all</font>). "
        "El plazo final es el plazo inicial más los días de prórroga. La fecha final corre ese plazo desde la fecha inicial. "
        "Un FIC legalizado, anulado, en reintegro o en cierre no cuenta como vencido.",
        [
            ["Transferencia FIC", "Alta", "no_cdp", "fic.fic"],
            ["Seguimiento legalización", "Actualización", "no_cdp", "Misma fila; usa la fecha final"],
            ["Modificación / prórroga", "Actualización", "no_cdp", "Recalcula plazo_final_dias y la fecha final"],
        ],
    )
    base(
        "Presupuesto",
        "Identificador <font face='Courier'>presupuesto</font>, ruta "
        "<font face='Courier'>/app/temas/presupuesto</font>. Está conectado como tema de la misma tabla "
        "<font face='Courier'>public.records</font>. No tiene capas ni Silver. Cada registro es una asignación "
        "por rubro y vigencia. El valor de cabecera es el presupuesto en pesos.",
        [
            ["Asignación", "Registro del tema", "rubro + vigencia", "public.records; campos rubro, vigencia y valor en el payload"],
        ],
    )
    base(
        "Ejecución financiera",
        "Identificador <font face='Courier'>ejecucion-financiera</font>. No usa formulario de captura. "
        "Entra el reporte Fidusap tal como sale. Se lee primero la pestaña SMD; si no existe, la hoja "
        "de CDP extendido, saltando las filas de título hasta el encabezado No CDP. Solo pasan el área "
        "ejecutora SMD o el área solicitante de Manejo de Desastres. Cada subida marca el corte con el "
        "nombre del archivo y reemplaza el corte anterior por número de CDP. El tablero agrupa por línea. "
        "Saldo por comprometer es CDP menos RC. La apropiación y el disponible salen del cupo escrito a mano "
        "para ese corte, no de un catálogo externo. Disponible es cupo menos CDP.",
        [
            ["Carga Fidusap", "Reemplazo por corte", "No CDP", "public.records del tema; grilla SMD"],
            ["Cupo por línea", "Formulario del corte", "línea + corte", "corte-cupo.ts; no viene en el Excel"],
            ["Tablero", "Lectura", "línea", "CDP, compromiso, saldo, pagado y por pagar"],
        ],
    )
    base(
        "Subsidios de arriendo",
        "Identificador <font face='Courier'>subsidios-de-arriendos</font>, versión 3. La lectura es "
        "<font face='Courier'>subsidios_arriendos.consolidado</font>. Cada Excel es un envío: el nombre "
        "del archivo trae número de envío, municipio y departamento. El consolidado guarda "
        "<font face='Courier'>numero_envio</font>, <font face='Courier'>n_orden</font>, estado, documentos, "
        "arrendador, arrendatario, vivienda, tenencia, contrato, duración, fechas, valor pagado y código DANE. "
        "Departamento y municipio solo se aceptan si están en DIVIPOLA. El formulario es opcional, para un alta "
        "puntual; no reemplaza el Excel. <font face='Courier'>uuid</font> viene en el archivo de consolidado "
        "y, si el alta es puntual, se genera al guardar. No se pide en pantalla.",
        [
            ["Consolidado del envío", "Carga Excel", "numero_envio + n_orden", "subsidios_arriendos.consolidado"],
            ["Alta puntual", "Formulario opcional", "uuid generado", "Misma capa del consolidado"],
        ],
    )

    story.append(Marca("s62"))
    story.append(P("5.2 ARQUITECTURA DE LA SOLUCIÓN", "h2"))
    story.append(Marca("s621"))
    story.append(P("ARQUITECTURA GENERAL DE LA SOLUCIÓN", "h3"))
    story.append(P(
        "La solución tiene tres planos sobre Alibaba Cloud. El plano de aplicación atiende a los "
        "usuarios y es el único que escribe negocio. El plano de datos es el RDS. El plano analítico "
        "es Quick BI, conectado en solo lectura práctica al mismo RDS (el usuario de aplicación es, "
        "hoy, también el de los tableros, hasta separar el rol <font face='Courier'>medallion_reader</font>, "
        "que exige privilegio de creación de roles que esta cuenta no tiene)."
    ))
    story.append(tabla(
        ["Plano", "Componente", "Responsabilidad"],
        [
            ["Aplicación", "Servicio Next.js en Alibaba Cloud (ECS con contenedor, o ACK)", "Captura, Excel, mapa, API, autenticación, PDF y embed de tableros."],
            ["Datos", "RDS PostgreSQL 18", "Única base. Esquemas public, medallion, vistas por tema, Silver y plataforma."],
            ["Archivos", "Volumen de la instancia u OSS", "Binario del Excel. El metadato está en public.uploads."],
            ["Analítica", "Quick BI", "Tableros sobre vistas y tablas Silver. Misma instancia, SSL desactivado."],
            ["Identidad", "Sesión de la aplicación y, cuando se activa, Keycloak", "Rol de aplicación y ACL por tema."],
            ["Borde", "Balanceador de Alibaba Cloud (SLB) con TLS", "HTTPS hacia el servicio de aplicación. El RDS no se publica a internet abierto."],
        ],
        [3.2 * cm, 6.4 * cm, 7.2 * cm],
    ))
    story.append(Spacer(1, 6))
    story.append(P(
        "Secuencia de una consulta de tablero: el navegador pide el embed a "
        "<font face='Courier'>POST /api/quickbi/embed-url</font>; la aplicación obtiene el ticket "
        "del servicio Quick BI configurado en <font face='Courier'>QUICKBI_UPSTREAM_BASE_URL</font> "
        "o, si se configura el acceso directo, con la AccessKey de Alibaba en el servidor. El "
        "navegador muestra el iframe. Los números del tablero salen del RDS, no de una copia en otro motor."
    ))
    story.append(P(
        "Secuencia de una carga: el navegador envía el archivo a "
        "<font face='Courier'>/api/themes/{tema}/uploads</font>. La aplicación valida, escribe "
        "registros y guarda el binario. Quick BI ve el resultado cuando la vista Bronce —y, si "
        "aplica, el Silver sincronizado— incluye las filas nuevas."
    ))

    story.append(Marca("s622"))
    story.append(P("COMPONENTES TECNOLÓGICOS E INFRAESTRUCTURA", "h3"))
    story.append(P("<b>Conexión a la base.</b> Password en el almacén de secretos de la instancia o de KMS. No está en el repositorio.", "body"))
    story.append(tabla(
        ["Parámetro", "Valor"],
        [
            ["Motor", "PostgreSQL 18"],
            ["Servicio", "ApsaraDB RDS, Alibaba Cloud"],
            ["Host", "pgm-7gotc9vw1p903hrzbo.pg.rds-aliyun-america.rds.aliyuncs.com"],
            ["Puerto", "5432"],
            ["Base", "d01_p011_aplicativo_temas"],
            ["Usuario de aplicación", "d01_p011_aplicativo_temas"],
            ["SSL", "Desactivado. URI con sslmode=disable. JDBC con ssl=false."],
            ["Variables", "DATABASE_URL y MEDALLION_DATABASE_URL, misma instancia"],
            ["Salud", "GET /api/health debe responder db = up y un host rds.aliyuncs.com"],
        ],
        [4.6 * cm, 12.2 * cm],
    ))
    story.append(Spacer(1, 6))
    story.append(P("<b>Grupo de seguridad.</b> El puerto 5432 solo acepta la red de la aplicación y la red de Quick BI. No queda abierto a 0.0.0.0/0.", "body"))
    story.append(P("<b>API principal.</b>", "body"))
    story.append(tabla(
        ["Ruta", "Uso"],
        [
            ["/api/health", "Disponibilidad y comprobación de que la aplicación habla con el RDS."],
            ["/api/auth", "Inicio de sesión."],
            ["/api/me/access", "Temas que el usuario puede ver según rol y ACL."],
            ["/api/themes/{tema}/records", "Altas, consultas y edición de registros."],
            ["/api/themes/{tema}/uploads", "Carga Excel y su resultado."],
            ["/api/themes/{tema}/template", "Plantilla Excel de la versión vigente."],
            ["/api/uploads", "Bandeja de cargas."],
            ["/api/quickbi/embed-url", "Ticket para incrustar un tablero."],
            ["/api/analytics/national", "Indicadores agregados de mando."],
            ["/api/reports/theme y /api/reports/national", "PDF de tema y de nivel nacional."],
            ["/api/v1/cases y /api/v1/tasks", "Casos y tareas del esquema de plataforma."],
            ["/api/admin/access y /api/admin/accounts", "ACL y cuentas. Solo administración."],
        ],
        [6.6 * cm, 10.2 * cm],
    ))
    story.append(Spacer(1, 6))
    story.append(P(
        "<b>Empaquetado.</b> La imagen de la aplicación se construye con el Dockerfile del "
        "repositorio (multi-etapa, salida standalone) y se publica en el Container Registry de "
        "Alibaba Cloud. El servicio corre en ECS o en ACK. Las variables de entorno salen de "
        "KMS o del almacén de secretos del servicio, no de un archivo versionado. "
        "<font face='Courier'>AUTH_URL</font> es la URL HTTPS pública. "
        "<font face='Courier'>ACL_STRICT</font> queda en true. "
        "<font face='Courier'>SECURITY_ALLOW_LOCALHOST</font> queda en false."
    ))
    story.append(P(
        "<b>Quick BI.</b> El dataset apunta a las vistas del tema o a las tablas Silver, con el "
        "JDBC de la sección de conexión. El workspace autoriza los pageId que la aplicación embebe. "
        "Un tablero vacío con la base poblada indica un pageId de otro workspace, no una base vacía."
    ))

    story.append(Marca("s63"))
    story.append(P("5.3 LINEAMIENTOS TÉCNICOS DE SEGURIDAD, OPERACIÓN Y ESCALABILIDAD", "h2"))
    story.append(tabla(
        ["Lineamiento", "Qué contempla", "Detalle"],
        [
            ["Seguridad", "Identidad, ACL, secreto y red", "Sesión de la aplicación. Producción con ACL estricta. Password de RDS y AccessKey de Quick BI solo en el almacén de secretos. RDS sin exposición pública. HTTPS en el balanceador. Clasificación Interno para valores, NIT y trazas de auditoría."],
            ["Mínimo privilegio", "Escritura solo por la API", "Quick BI no debe usar una cuenta con permiso de borrar public.records. Cuando exista privilegio para crear roles, el tablero pasa a medallion_reader (SELECT)."],
            ["Integridad", "Una fila viva por contenido", "Hash único, borrado lógico y versiones append-only. La sincronización Silver no pisa la tabla operativa."],
            ["Operación", "Cómo se sabe que está sana", "GET /api/health. Revisión de uploads.errors después de cada corte. Sincronización Silver después de una carga masiva de Agua o Puentes, antes de refrescar el tablero que lee esas tablas."],
            ["Continuidad", "Respaldo del RDS", "Respaldo automático de la instancia RDS según la política de la cuenta Alibaba. El volumen u OSS de Excel se respalda aparte: no está dentro del dump lógico si solo se exportan tablas."],
            ["Escalabilidad", "Más réplicas de aplicación, una sola base", "Se escala el servicio de aplicación. No se parte la base por tema. Con más de una réplica, los Excel van a OSS para que cualquier réplica lea el mismo archivo. El límite de cuerpo de la API es 12 MB por defecto."],
            ["Cambio", "Evolución del formulario", "Subir schema_version del tema, regenerar vistas del contrato y, si el tema tiene Silver, volver a generar y sincronizar. No se altera el diccionario de public.records para un campo de una sola hoja."],
        ],
        [2.8 * cm, 4.0 * cm, 10.0 * cm],
    ))
    story.append(Spacer(1, 8))
    story.append(P(
        "El personal técnico que reciba este manual debe poder: conectar un cliente SQL al RDS con "
        "los parámetros de la sección 5.2.2, distinguir un registro vivo de uno borrado, leer el "
        "resultado de una carga, explicar por qué Quick BI y la aplicación muestran el mismo corte, "
        "y saber que un campo nuevo de un tema entra por field_schema y por la vista de la hoja, "
        "no por una columna nueva en public.records."
    ))

    story.append(Marca("s7"))
    story.append(barra("7. CONTROL DE CAMBIOS DEL DOCUMENTO"))
    story.append(tabla(
        ["VERSIÓN", "DESCRIPCIÓN DEL CAMBIO", "FECHA"],
        [
            ["01", "Emisión inicial. Modelo de datos, conexiones en Alibaba Cloud y las diez bases conectadas.", "08/10/2026"],
            ["02", "Revisión técnica: banner, control de cambios, pie de firmas y precisión de capas, llaves y tablas.", "08/10/2026"],
        ],
        [2.4 * cm, 12.2 * cm, 3.2 * cm],
    ))
    story.append(Spacer(1, 14))
    firma = [
        [cell("ELABORÓ", True), cell("REVISÓ", True), cell("APROBÓ", True)],
        [
            cell("<b>Nombre:</b> Carlos Fernando Mejia San Juan"),
            cell("<b>Nombre:</b> Johan Manuel Redondo"),
            cell("<b>Nombre:</b> Isabel Cristina Arboleda López"),
        ],
        [
            cell("<b>Cargo:</b> Contratista Fondo Nacional De Gestión Del Riesgo De Desastres - FNGRD"),
            cell("<b>Cargo:</b> Contratista Fondo Nacional De Gestión Del Riesgo De Desastres - FNGRD"),
            cell("<b>Cargo:</b> Coordinadora - Grupo de Tecnologías de la Información (E)."),
        ],
    ]
    pie = Table(firma, colWidths=[5.6 * cm, 5.6 * cm, 5.6 * cm])
    pie.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.8, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (0, 1), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(pie)
    return story


def main():
    global PAGE_TOTAL
    from io import BytesIO

    from pypdf import PdfReader

    OUT.parent.mkdir(parents=True, exist_ok=True)
    borrador = BytesIO()
    ManualDoc(borrador).build(build())
    PAGE_TOTAL = len(PdfReader(borrador).pages)
    ManualDoc(str(OUT)).build(build())
    print(OUT)


if __name__ == "__main__":
    main()
