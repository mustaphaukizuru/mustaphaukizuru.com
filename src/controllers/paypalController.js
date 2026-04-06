const prisma = require("../lib/prisma")
const {
  createPaypalOrder,
  capturePaypalOrder,
} = require("../services/paypalService")
const { sendOrderPaidEmail, sendOrderPlacedEmail } = require("../utils/mailer")
const { notifyOrderPaid } = require("../services/notificationService")

async function createOrder(req, res) {
  try {
    const { orderId } = req.body

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
      })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    const paypalOrder = await createPaypalOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      currency: order.currency || "USD",
    })

    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId: order.id,
        paymentGateway: "paypal",
      },
    })

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          gatewayTransactionId: paypalOrder.id,
          gatewaySessionId: paypalOrder.id,
          amount: order.totalAmount,
          currency: order.currency || "USD",
          paymentStatus: "pending",
          failureReason: null,
        },
      })
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          paymentGateway: "paypal",
          gatewayTransactionId: paypalOrder.id,
          gatewaySessionId: paypalOrder.id,
          amount: order.totalAmount,
          currency: order.currency || "USD",
          paymentStatus: "pending",
        },
      })
    }

    return res.status(200).json({
      success: true,
      id: paypalOrder.id,
    })
  } catch (error) {
    console.error("PayPal create order error:", error)
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to create PayPal order",
    })
  }
}

async function captureOrder(req, res) {
  try {
    const { paypalOrderId, orderId } = req.body

    if (!paypalOrderId || !orderId) {
      return res.status(400).json({
        success: false,
        message: "paypalOrderId and orderId are required",
      })
    }

    // Idempotency: if already paid, skip capture and return success
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    })
    if (existingOrder?.status === "paid") {
      return res.status(200).json({ success: true, message: "Order already paid" })
    }

    const capture = await capturePaypalOrder(paypalOrderId)

    const captureId =
      capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: "paid", paidAt: new Date() },
      include: {
        items: {
          include: {
            product: { select: { id: true, title: true } },
          },
        },
      },
    })

    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId,
        paymentGateway: "paypal",
      },
    })

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          gatewayTransactionId: captureId || paypalOrderId,
          gatewaySessionId: paypalOrderId,
          paymentStatus: "paid",
          paidAt: new Date(),
          failureReason: null,
        },
      })
    } else {
      await prisma.payment.create({
        data: {
          orderId,
          userId: updatedOrder.userId,
          paymentGateway: "paypal",
          gatewayTransactionId: captureId || paypalOrderId,
          gatewaySessionId: paypalOrderId,
          amount: updatedOrder.totalAmount,
          currency: updatedOrder.currency || "USD",
          paymentStatus: "paid",
          paidAt: new Date(),
        },
      })
    }

    // Fire-and-forget — email must not delay the payment response
    sendOrderPaidEmail(updatedOrder).catch((e) => console.error('[email]', e.message))
    notifyOrderPaid(updatedOrder).catch(() => {})

    return res.status(200).json({
      success: true,
      message: "PayPal payment captured successfully",
    })
  } catch (error) {
    console.error("PayPal capture error:", error)

    if (req.body?.orderId) {
      await prisma.order.update({
        where: { id: req.body.orderId },
        data: { status: "failed" },
      }).catch(() => null)

      const existingPayment = await prisma.payment.findFirst({
        where: {
          orderId: req.body.orderId,
          paymentGateway: "paypal",
        },
      }).catch(() => null)

      if (existingPayment) {
        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            paymentStatus: "failed",
            failureReason: error.message || "PayPal capture failed",
          },
        }).catch(() => null)
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Capture failed",
    })
  }
}

async function handlePaypalWebhook(req, res) {
  try {
    const event = req.body

    await prisma.paymentWebhook.create({
      data: {
        paymentGateway: "paypal",
        eventType:      event?.event_type || "unknown",
        payloadJson:    event || {},
      },
    }).catch(() => null)

    const resource = event?.resource || {}
    const orderId =
      resource?.custom_id ||
      resource?.purchase_units?.[0]?.custom_id ||
      resource?.purchase_units?.[0]?.reference_id ||
      null

    if (orderId) {
      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "paid" },
        }).catch(() => null)

        const existingPayment = await prisma.payment.findFirst({
          where: {
            orderId,
            paymentGateway: "paypal",
          },
        }).catch(() => null)

        if (existingPayment) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              paymentStatus: "paid",
              paidAt: new Date(),
            },
          }).catch(() => null)
        }
      }

      if (event.event_type === "PAYMENT.CAPTURE.PENDING") {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "pending" },
        }).catch(() => null)

        const existingPayment = await prisma.payment.findFirst({
          where: {
            orderId,
            paymentGateway: "paypal",
          },
        }).catch(() => null)

        if (existingPayment) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              paymentStatus: "pending",
            },
          }).catch(() => null)
        }
      }

      if (
        event.event_type === "PAYMENT.CAPTURE.DENIED" ||
        event.event_type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED"
      ) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "failed" },
        }).catch(() => null)

        const existingPayment = await prisma.payment.findFirst({
          where: {
            orderId,
            paymentGateway: "paypal",
          },
        }).catch(() => null)

        if (existingPayment) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              paymentStatus: "failed",
              failureReason: event?.event_type || "PayPal payment failed",
            },
          }).catch(() => null)
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed",
    })
  } catch (error) {
    console.error("PayPal webhook error:", error)
    return res.status(500).json({
      success: false,
      message: "Webhook error",
    })
  }
}

module.exports = {
  createOrder,
  captureOrder,
  handlePaypalWebhook,
}