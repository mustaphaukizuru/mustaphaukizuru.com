# Catálogo de servicios · agosto 2026

Fuente: "CONSULTORÍA ESTRATÉGICA DE TI" (PDF, 2026-08-24). Este documento es la
referencia para las páginas de servicios, el seed de `Service`/`ServicePackage`,
el SEO y los textos ES/EN. Estructura: 4 categorías → 21 servicios.

## 1. Consultoría Estratégica de TI

| Servicio | Descripción |
|---|---|
| Auditoría de la pila de software | Revisión de licencias existentes para eliminar suscripciones duplicadas y reducir el desperdicio. |
| Participación fraccional de CTO | Liderazgo técnico a tiempo parcial: hojas de ruta y orientación en contratación. |
| Evaluación de proveedores y RFP | Experto independiente que revisa ofertas de software de terceros en cuanto a equidad. |
| Hoja de ruta para la transformación digital | Migraciones paso a paso de papel/hojas de cálculo a plataformas automatizadas. |
| Cumplimiento y evaluación de riesgos | Auditoría de arquitectura para cumplir leyes mexicanas de privacidad (LFPDPPP). |

## 2. Integración con IA y Automatización de Flujos de Trabajo

| Servicio | Descripción |
|---|---|
| Bots de persona personalizados | Asistentes LLM entrenados exclusivamente en la voz y documentos de marca del cliente. |
| Calificadores de líderes de WhatsApp | Agentes de chat automatizados que responden FAQs y sincronizan prospectos al CRM. |
| Pipelines API multiplataforma | Conectar herramientas desconectadas (p. ej. pagos, Slack, email) con Make o Zapier. |
| Base de conocimiento interna RAG | Motores de búsqueda corporativos privados con bases vectoriales (Pinecone). |
| Flujos de extracción de datos | Herramientas que analizan PDFs, facturas o formularios en hojas de cálculo limpias. |

## 3. Arquitectura en la Nube y Migración de Infraestructura

| Servicio | Descripción |
|---|---|
| Migración on-premise a la nube | Mover servidores físicos de oficina de forma segura a AWS, Azure o GCP. |
| Optimización de facturas en la nube | Auditar configuraciones para dimensionar servidores y reducir costos hasta 40 %. |
| Planificación de recuperación ante desastres | Respaldos automatizados y cifrados con conmutación por error. |
| Docker y contenedorización | Empaquetar aplicaciones antiguas en contenedores para despliegues rápidos. |
| Endurecimiento de seguridad zero-trust | Controles de acceso para trabajo remoto de nivel empresarial. |

## 4. Ingeniería de Producto Digital de Extremo a Extremo

| Servicio | Descripción |
|---|---|
| Wireframing interactivo UI/UX | Prototipos clicables de alta fidelidad antes de escribir backend. |
| Desarrollo de aplicaciones web MVP | Productos mínimos viables rápidos y funcionales con ecosistemas modernos. |
| Aplicaciones móviles multiplataforma | Base de código única para iOS y Android. |
| Diseño seguro de APIs | APIs backend rápidas y bien documentadas para enlazar aplicaciones de negocio. |
| Automatización de pipeline CI/CD | Scripts de despliegue automatizados sin tiempo de inactividad. |
| Mantenimiento gestionado | Soporte mensual recurrente: correcciones, parches y despliegue de funciones. |

## Notas de implementación

- Cada categoría = una `Service` con `slug` estable; cada servicio = un bloque
  de `ServiceFeature` o una entrada del catálogo (`web/src/data/servicesCatalogue.js`).
- CTA único por página de servicio: **Agendar una llamada de 30 min** (gratis).
  Los paquetes de precio fijo mantienen el checkout; el trabajo a medida va
  llamada → propuesta → factura.
- Mercado objetivo: PyMEs mexicanas (LFPDPPP, MXN). Textos en ES y EN.
- La mención de Stripe en el PDF es un ejemplo de integración de terceros —
  el sitio no usa Stripe (pagos: MercadoPago + PayPal).
