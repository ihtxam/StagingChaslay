package com.rebornsense.printbridge.fleet

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.card.MaterialCardView
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.textfield.TextInputEditText
import com.rebornsense.printbridge.R

class FleetSetupActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_fleet_setup)
        title = getString(R.string.fleet_setup_title)
        bindUi()
    }

    override fun onResume() {
        super.onResume()
        bindUi()
    }

    private fun bindUi() {
        val ownerStatus = findViewById<TextView>(R.id.fleetOwnerStatusText)
        val provisionCommand = findViewById<TextView>(R.id.fleetProvisionCommandText)
        val configCard = findViewById<MaterialCardView>(R.id.fleetKioskConfigCard)
        val kioskSwitch = findViewById<SwitchMaterial>(R.id.fleetKioskSwitch)
        val adminPinInput = findViewById<TextInputEditText>(R.id.fleetAdminPinInput)
        val posUrlInput = findViewById<TextInputEditText>(R.id.fleetPosUrlInput)
        val browserText = findViewById<TextView>(R.id.fleetBrowserText)
        val launchBtn = findViewById<Button>(R.id.fleetLaunchKioskBtn)
        val exitBtn = findViewById<Button>(R.id.fleetExitKioskBtn)

        val isOwner = KioskController.isDeviceOwner(this)
        ownerStatus.text = if (isOwner) {
            getString(R.string.fleet_device_owner_active)
        } else {
            getString(R.string.fleet_device_owner_missing)
        }
        provisionCommand.text = getString(
            R.string.fleet_provision_adb_command,
            packageName,
        )
        configCard.visibility = if (isOwner) View.VISIBLE else View.GONE

        if (!isOwner) return

        adminPinInput.setText(FleetPreferences.getAdminPin(this))
        posUrlInput.setText(FleetPreferences.getPosUrlOverride(this).orEmpty())
        kioskSwitch.setOnCheckedChangeListener(null)
        kioskSwitch.isChecked = FleetPreferences.isKioskEnabled(this)
        kioskSwitch.setOnCheckedChangeListener { _, checked ->
            persistFields(adminPinInput, posUrlInput)
            if (checked) {
                KioskController.enableKiosk(this)
                Toast.makeText(this, R.string.fleet_kiosk_enabled_toast, Toast.LENGTH_SHORT).show()
                return@setOnCheckedChangeListener
            }
            kioskSwitch.isChecked = true
            confirmDisableKiosk {
                KioskController.disableKiosk(this)
                kioskSwitch.isChecked = false
                Toast.makeText(this, R.string.fleet_kiosk_disabled_toast, Toast.LENGTH_SHORT).show()
            }
        }

        val browser = KioskController.resolveBrowserPackage(this)
        browserText.text = if (browser != null) {
            getString(R.string.fleet_browser_detected, browser)
        } else {
            getString(R.string.fleet_browser_missing)
        }

        launchBtn.setOnClickListener {
            persistFields(adminPinInput, posUrlInput)
            KioskController.enableKiosk(this)
            kioskSwitch.isChecked = true
            KioskController.launchKioskShell(this)
        }

        exitBtn.setOnClickListener {
            promptAdminPin { pin ->
                if (!FleetPreferences.verifyAdminPin(this, pin)) {
                    Toast.makeText(this, R.string.fleet_admin_pin_wrong, Toast.LENGTH_SHORT).show()
                    return@promptAdminPin
                }
                KioskController.disableKiosk(this)
                kioskSwitch.isChecked = false
                if (KioskController.isKioskActive(this)) {
                    KioskController.stopLockTask(this)
                }
                Toast.makeText(this, R.string.fleet_kiosk_disabled_toast, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun persistFields(adminPinInput: TextInputEditText, posUrlInput: TextInputEditText) {
        FleetPreferences.setAdminPin(this, adminPinInput.text?.toString().orEmpty())
        FleetPreferences.setPosUrlOverride(this, posUrlInput.text?.toString())
    }

    private fun confirmDisableKiosk(onConfirm: () -> Unit) {
        AlertDialog.Builder(this)
            .setTitle(R.string.fleet_disable_kiosk_title)
            .setMessage(R.string.fleet_disable_kiosk_message)
            .setPositiveButton(R.string.fleet_disable_kiosk_confirm) { _, _ -> onConfirm() }
            .setNegativeButton(R.string.cancel) { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }

    private fun promptAdminPin(onOk: (String) -> Unit) {
        val input = TextInputEditText(this).apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or
                android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.fleet_admin_pin_prompt_title)
            .setView(input)
            .setPositiveButton(R.string.ok) { _, _ -> onOk(input.text?.toString().orEmpty()) }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }
}
