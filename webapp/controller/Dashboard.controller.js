sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("zapp.controller.Dashboard", {
        onInit: function () {
        },

        // Hàm xử lý khi bấm nút mũi tên quay lại
        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            // Điều hướng về màn hình Home, truyền tham số 'true' để xóa lịch sử, tránh lỗi vòng lặp nút Back của trình duyệt
            oRouter.navTo("RouteHome", {}, true); 
        }
    });
});