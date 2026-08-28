package com.rebornsense.printbridge

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
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
        private val idText: TextView = itemView.findViewById(R.id.printerIdText)
        private val typeText: TextView = itemView.findViewById(R.id.printerTypeText)
        private val defaultBadge: TextView = itemView.findViewById(R.id.defaultBadge)
        private val setDefaultBtn: Button = itemView.findViewById(R.id.setDefaultBtn)
        private val testRowBtn: Button = itemView.findViewById(R.id.testRowBtn)

        fun bind(
            endpoint: PrinterEndpoint,
            defaultId: String?,
            onSetDefault: (PrinterEndpoint) -> Unit,
            onTestPrint: (PrinterEndpoint) -> Unit,
        ) {
            val isDefault = endpoint.id == defaultId
            nameText.text = endpoint.name
            idText.text = endpoint.id
            typeText.text = endpoint.connectionType.uppercase()
            defaultBadge.visibility = if (isDefault) View.VISIBLE else View.GONE
            setDefaultBtn.isEnabled = !isDefault
            setDefaultBtn.setOnClickListener { onSetDefault(endpoint) }
            testRowBtn.setOnClickListener { onTestPrint(endpoint) }
        }
    }
}
