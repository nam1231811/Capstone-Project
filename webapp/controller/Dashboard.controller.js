sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("zapp.controller.Dashboard", {
        onInit: function () {
            // MOCK DATA
            var oData = {
                kpi: { totalTables: 24, changedToday: 156, totalRecords: 125000 },
                lineData: [
                    { date: "T2", create: 12, update: 45, delete: 2 },
                    { date: "T3", create: 5, update: 30, delete: 0 },
                    { date: "T4", create: 20, update: 60, delete: 15 },
                    { date: "T5", create: 8, update: 25, delete: 1 },
                    { date: "T6", create: 15, update: 50, delete: 5 },
                    { date: "T7", create: 3, update: 10, delete: 0 },
                    { date: "CN", create: 0, update: 5, delete: 0 }
                ],
                topUsers: [
                    { user: "DEV-092", actions: 120 },
                    { user: "ADMIN", actions: 85 },
                    { user: "USER-01", actions: 40 },
                    { user: "USER-05", actions: 25 },
                    { user: "SYSTEM", actions: 10 }
                ],
                // Data Pie mặc định khi mới vào (Toàn hệ thống)
                pieData: [
                    { status: "Data Hợp lệ", count: 8500 },
                    { status: "Trống trường bắt buộc", count: 320 },
                    { status: "Sai định dạng", count: 150 }
                ],
                recentLogs: [
                    { tableName: "ZEMPLOYEE_105", action: "UPDATE", user: "DEV-092", time: "10:05", status: "Success", rowId: "11" },
                    { tableName: "ZCOURSE_DEV335", action: "CREATE", user: "ADMIN", time: "09:30", status: "Success", rowId: "2" },
                    { tableName: "ZEMPLOYEE_105", action: "DELETE", user: "USER-01", time: "09:15", status: "Success", rowId: "9" },
                    { tableName: "ZDEPARTMENT", action: "UPDATE", user: "DEV-092", time: "08:45", status: "Success", rowId: "5" },
                    { tableName: "ZCONFIG", action: "UPDATE", user: "SYSTEM", time: "00:01", status: "Success", rowId: "1" }
                ]
            };

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "dash");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true); 
        },

        onPressKPI: function() {
            sap.m.MessageToast.show("Sau này có thể click vào đây để xem báo cáo chi tiết!");
        },

        // --- HÀM XỬ LÝ SEARCH CẢNH BÁO DATA CHO TỪNG BẢNG ---
        onSearchTableQuality: function(oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oModel = this.getView().getModel("dash");

            if (sQuery) {
                // Giả lập load data rác cho bảng vừa search
                oModel.setProperty("/pieData", [
                    { status: "Data Hợp lệ", count: Math.floor(Math.random() * 500) + 100 },
                    { status: "Trống trường bắt buộc", count: Math.floor(Math.random() * 50) + 10 },
                    { status: "Sai định dạng", count: Math.floor(Math.random() * 20) + 1 }
                ]);
                sap.m.MessageToast.show("Đã tải cảnh báo cho bảng: " + sQuery.toUpperCase());
            } else {
                // Nếu xóa trắng ô search, trả về data toàn hệ thống
                oModel.setProperty("/pieData", [
                    { status: "Data Hợp lệ", count: 8500 },
                    { status: "Trống trường bắt buộc", count: 320 },
                    { status: "Sai định dạng", count: 150 }
                ]);
            }
        },

        onRecentLogPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oBindingContext = oItem.getBindingContext("dash");
            var oLogData = oBindingContext.getObject();

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("DetailData", {
                layout: sap.f.LayoutType.TwoColumnsMidExpanded, 
                tableName: oLogData.tableName,
                rowId: oLogData.rowId
            });
        }
    });
}); 