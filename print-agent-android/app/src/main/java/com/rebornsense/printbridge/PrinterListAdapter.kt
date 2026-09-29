package com.rebornsense.printbridge

import android.util.Log
import android.view.InflateException
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.rebornsense.printbridge.print.PrinterEndpoint

class PrinterListAdapter(
    private val onSetDefault: (PrinterEndpoint) -> Unit,
    private val onTestPrint: (PrinterEndpoint) -> Unit,
) : RecyclerView.Adapter<PrinterListAdapter.RowHolder>() {

    private var items: List<PrinterEndpoint> = emptyList()
    private var defaultId: String? = null

    fun submit(printers: List<PrinterEndpoint>, selectedDefaultId: String?) {
        items = printers
        defaultId = selectedDefaultId
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RowHolder {
        val view = try {
            LayoutInflater.from(parent.context).inflate(R.layout.item_printer_row, parent, false)
        } catch (error: InflateException) {
            // Layout colors are the real fix. This keeps one bad row from killing MainActivity.
            Log.e(TAG, "printer row failed to inflate", error)
            BridgeCrashLog.record(parent.context, error, "printer-row-inflate")
            fallbackRow(parent)
        }
        return RowHolder(view)
    }

    private fun fallbackRow(parent: ViewGroup): TextView {
        return TextView(parent.context).apply {
            layoutParams = RecyclerView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            val pad = (12 * parent.resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
    }

    override fun onBindViewHolder(holder: RowHolder, position: Int) {
        holder.bind(items[position], defaultId, onSetDefault, onTestPrint)
    }

    override fun getItemCount(): Int = items.size

    class RowHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val nameText: TextView? = itemView.findViewById(R.id.printerNameText)
        private val subtitleText: TextView? = itemView.findViewById(R.id.printerSubtitleText)
        private val typeText: TextView? = itemView.findViewById(R.id.printerTypeText)
        private val defaultBadge: TextView? = itemView.findViewById(R.id.defaultBadge)
        private val testRowBtn: MaterialButton? = itemView.findViewById(R.id.testRowBtn)

        fun bind(
            endpoint: PrinterEndpoint,
            defaultId: String?,
            onSetDefault: (PrinterEndpoint) -> Unit,
            onTestPrint: (PrinterEndpoint) -> Unit,
        ) {
            val isDefault = endpoint.id == defaultId
            val context = itemView.context
            val title = PrinterDisplay.title(endpoint)
            val name = nameText
            if (name == null) {
                (itemView as? TextView)?.text = title
                itemView.setOnClickListener {
                    if (!isDefault) onSetDefault(endpoint)
                }
                return
            }
            name.text = title
            val subtitle = PrinterDisplay.subtitle(context, endpoint)
            val subtitleView = subtitleText
            if (subtitle.isNullOrBlank() || subtitleView == null) {
                subtitleView?.visibility = View.GONE
            } else {
                subtitleView.visibility = View.VISIBLE
                subtitleView.text = subtitle
            }
            typeText?.text = PrinterDisplay.typeLabel(context, endpoint)
            defaultBadge?.visibility = if (isDefault) View.VISIBLE else View.GONE
            itemView.setOnClickListener {
                if (!isDefault) onSetDefault(endpoint)
            }
            testRowBtn?.setOnClickListener { onTestPrint(endpoint) }
        }
    }

    private companion object {
        const val TAG = "PrinterListAdapter"
    }
}
