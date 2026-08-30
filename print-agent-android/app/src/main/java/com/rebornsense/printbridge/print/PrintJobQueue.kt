package com.rebornsense.printbridge.print

import android.content.Context
import android.util.Base64
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicInteger

data class PrintJob(
    val endpoint: PrinterEndpoint,
    val data: ByteArray,
    val attempts: Int = 0,
)

class PrintJobQueue(
    private val registry: DriverRegistry,
) {
    private val queue = LinkedBlockingQueue<PrintJob>()
    private val depth = AtomicInteger(0)
    private var worker: Thread? = null

    @Volatile
    private var appContext: Context? = null

    fun start(context: Context) {
        appContext = context.applicationContext
        if (worker?.isAlive == true) return
        worker = Thread({ runLoop() }, "print-bridge-queue").also { it.start() }
    }

    fun stop() {
        worker?.interrupt()
        worker = null
    }

    fun queueDepth(): Int = depth.get()

    fun enqueue(context: Context, endpoint: PrinterEndpoint, data: ByteArray) {
        appContext = context.applicationContext
        depth.incrementAndGet()
        queue.offer(PrintJob(endpoint, data))
    }

    private fun runLoop() {
        val delays = longArrayOf(1000, 2000, 5000, 10000, 30000)
        var lastBluetoothPrintMs = 0L
        while (!Thread.currentThread().isInterrupted) {
            val job = try {
                queue.take()
            } catch (_: InterruptedException) {
                break
            }
            val ctx = appContext ?: continue
            val driver = registry.driverFor(job.endpoint)
            if (driver == null) {
                depth.decrementAndGet()
                continue
            }
            if (job.endpoint.connectionType == "bluetooth") {
                val gap = System.currentTimeMillis() - lastBluetoothPrintMs
                if (lastBluetoothPrintMs > 0L && gap < BT_INTER_JOB_MS) {
                    Thread.sleep(BT_INTER_JOB_MS - gap)
                }
            }
            val result = driver.print(ctx, job.endpoint, job.data)
            if (result.isSuccess) {
                if (job.endpoint.connectionType == "bluetooth") {
                    lastBluetoothPrintMs = System.currentTimeMillis()
                }
                depth.decrementAndGet()
            } else if (job.attempts < delays.size) {
                try {
                    Thread.sleep(delays[job.attempts])
                } catch (_: InterruptedException) {
                    break
                }
                queue.offer(job.copy(attempts = job.attempts + 1))
            } else {
                depth.decrementAndGet()
            }
        }
    }

    companion object {
        private const val BT_INTER_JOB_MS = 1_500L

        fun decodeBase64(dataBase64: String): ByteArray {
            return Base64.decode(dataBase64, Base64.DEFAULT)
        }
    }
}
