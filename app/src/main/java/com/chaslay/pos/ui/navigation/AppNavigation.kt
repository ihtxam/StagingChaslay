package com.chaslay.pos.ui.navigation

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.admin.AdminHubScreen
import com.chaslay.pos.ui.auth.AuthViewModel
import com.chaslay.pos.ui.auth.LoginScreen
import com.chaslay.pos.ui.demo.DemoModeBanner
import com.chaslay.pos.ui.demo.DemoModeViewModel
import com.chaslay.pos.ui.ongoing.OngoingOrdersScreen
import com.chaslay.pos.ui.reservations.ReservationsScreen
import com.chaslay.pos.ui.orderhistory.OrderHistoryScreen
import com.chaslay.pos.ui.pos.PosScreen
import com.chaslay.pos.ui.waiter.WaiterPosScreen

sealed class AppRoute(val route: String) {
    data object Login : AppRoute("login")
    data object Pos : AppRoute("pos")
    data object Admin : AppRoute("admin")
    data object OrderHistory : AppRoute("order_history")
    data object OngoingOrders : AppRoute("ongoing_orders")
    data object Reservations : AppRoute("reservations")
}

@Composable
fun ChaslayNavHost(
    userAccess: UserAccess?,
    authViewModel: AuthViewModel = hiltViewModel(),
    demoModeViewModel: DemoModeViewModel = hiltViewModel()
) {
    val navController = rememberNavController()
    val isDemoMode by demoModeViewModel.isDemoMode.collectAsStateWithLifecycle()
    val demoUiState by demoModeViewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(demoUiState.snackbarMessageRes) {
        demoUiState.snackbarMessageRes?.let { resId ->
            snackbarHostState.showSnackbar(message = context.getString(resId))
            demoModeViewModel.clearSnackbar()
        }
    }

    if (userAccess == null) {
        LoginScreen(onLoggedIn = {})
        return
    }

    if (demoUiState.showGoLiveConfirm) {
        AlertDialog(
            onDismissRequest = demoModeViewModel::dismissGoLiveConfirm,
            title = { Text(stringResource(R.string.demo_go_live_confirm_title)) },
            text = { Text(stringResource(R.string.demo_go_live_confirm_body)) },
            confirmButton = {
                TextButton(onClick = demoModeViewModel::confirmGoLive) {
                    Text(stringResource(R.string.demo_go_live_button))
                }
            },
            dismissButton = {
                TextButton(onClick = demoModeViewModel::dismissGoLiveConfirm) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    // Plain Column + NavHost (no Scaffold subcompose — avoids measure crashes on first Pos compose).
    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            if (isDemoMode) {
                DemoModeBanner(
                    onGoLiveClick = demoModeViewModel::requestGoLive,
                    isPurging = demoUiState.isPurging
                )
            }
            // NavHost must fill a bounded box — weight(1f) on NavHost alone crashes on IME
            // inset / recompose (IllegalStateException in LocalOwnersProvider).
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            ) {
                NavHost(
                    navController = navController,
                    startDestination = AppRoute.Pos.route,
                    modifier = Modifier.fillMaxSize(),
                    enterTransition = { EnterTransition.None },
                    exitTransition = { ExitTransition.None },
                    popEnterTransition = { EnterTransition.None },
                    popExitTransition = { ExitTransition.None },
                ) {
                composable(AppRoute.Pos.route) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        if (userAccess.isWaiterProfile()) {
                            WaiterPosScreen(
                                userAccess = userAccess,
                                onLogout = { authViewModel.logout() }
                            )
                        } else {
                            PosScreen(
                                userAccess = userAccess,
                                onNavigate = { route ->
                                    navController.navigate(route) {
                                        launchSingleTop = true
                                    }
                                },
                                onBackToPos = {
                                    navController.popBackStack(AppRoute.Pos.route, inclusive = false)
                                },
                                onLogout = { authViewModel.logout() }
                            )
                        }
                    }
                }
                composable(AppRoute.OrderHistory.route) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        if (userAccess.canViewOrderHistory()) {
                            OrderHistoryScreen(onBack = { navController.popBackStack() })
                        }
                    }
                }
                composable(AppRoute.OngoingOrders.route) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        OngoingOrdersScreen(onBack = { navController.popBackStack() })
                    }
                }
                composable(AppRoute.Reservations.route) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        ReservationsScreen(onBack = { navController.popBackStack() })
                    }
                }
                if (userAccess.canAccessSettings() || userAccess.canManageProducts() || userAccess.canAccessReports()) {
                    composable(AppRoute.Admin.route) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            AdminHubScreen(
                                userAccess = userAccess,
                                onBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
                }
            }
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(androidx.compose.ui.Alignment.BottomCenter)
        )
    }
}
