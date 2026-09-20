package com.rebornsense.printbridge

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
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_printer_row, parent, false)
        return RowHolder(view)
    }

    override fun onBindViewHolder(holder: RowHolder, position: Int) {
        holder.bind(items[position], defaultId, onSetDefault, onTestPrint)
    }

    override fun getItemCount(): Int = items.size

    class RowHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val nameText: TextView = itemView.findViewById(R.id.printerNameText)
        private val subtitleText: TextView = itemView.findViewById(R.id.printerSubtitleText)
        private val typeText: TextView = itemView.findViewById(R.id.printerTypeText)
        private val defaultBadge: TextView = itemView.findViewById(R.id.defaultBadge)
        private val testRowBtn: MaterialButton = itemView.findViewById(R.id.testRowBtn)

        fun bind(
            endpoint: PrinterEndpoint,
            defaultId: String?,
            onSetDefault: (PrinterEndpoint) -> Unit,
            onTestPrint: (PrinterEndpoint) -> Unit,
        ) {
            val isDefault = endpoint.id == defaultId
            val context = itemView.context
            nameText.text = PrinterDisplay.title(endpoint)
            val subtitle = PrinterDisplay.subtitle(context, endpoint)
            if (subtitle.isNullOrBlank()) {
                subtitleText.visibility = View.GONE
            } else {
                subtitleText.visibility = View.VISIBLE
                subtitleText.text = subtitle
            }
            typeText.text = PrinterDisplay.typeLabel(context, endpoint)
            defaultBadge.visibility = if (isDefault) View.VISIBLE else View.GONE
            itemView.setOnClickListener {
                if (!isDefault) onSetDefault(endpoint)
            }
            testRowBtn.setOnClickListener { onTestPrint(endpoint) }
        }
    }
}
