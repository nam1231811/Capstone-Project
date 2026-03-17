sap.ui.define([], function () {
    "use strict";

    var PaginationHelper = {
        //Hàm xử lý khóa/mở khóa scrollbar
        applyScrollLock: function (oTable, bLock) {
            if (!oTable) return;

            oTable._bIsScrollLocked = bLock; //Lưu trạng thái khóa vào bảng

            //Gắn sự kiện để chặn scroll
            if (!oTable._bScrollBlockerAttached) {
                oTable.attachFirstVisibleRowChanged(function (oEvent) {
                    if (oTable._bIsScrollLocked && oEvent.getParameter("firstVisibleRow") !== 0) {
                        oTable.setFirstVisibleRow(0);
                    }
                });
                oTable._bScrollBlockerAttached = true;
            }

            //Xử lý giao diện
            if (bLock) {
                oTable.setFirstVisibleRow(0); 
                oTable.addStyleClass("myHiddenScrollbarTable"); 
            } else {
                oTable.removeStyleClass("myHiddenScrollbarTable"); 
            }
        },

        onPressLoadMore: function () {
            var oTable = this.getView().byId("dataTable");
            var oDisplayModel = this.getView().getModel("displayModel");
            
            PaginationHelper.applyScrollLock(oTable, false); //Mở cuộn chuột
            
            //Đổi trạng thái nút
            oDisplayModel.setProperty("/hasMore", false);
            oDisplayModel.setProperty("/hasLess", true);
        },

        onPressShowLess: function () {
            var oTable = this.getView().byId("dataTable");
            var oDisplayModel = this.getView().getModel("displayModel");
            
            PaginationHelper.applyScrollLock(oTable, true); //Khóa cuộn chuột
            
            //Đổi trạng thái nút
            oDisplayModel.setProperty("/hasLess", false); 
            oDisplayModel.setProperty("/hasMore", true); 
        }
    };

    return PaginationHelper;
});