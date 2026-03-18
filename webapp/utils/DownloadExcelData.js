sap.ui.define([
    "sap/ui/export/Spreadsheet",  
    "sap/m/MessageToast"
], function (Spreadsheet, MessageToast) {
    "use strict";

    return {
        onDownloadExcelPress: function (oController) {
            var oView = oController.getView();
            var oDisplayModel = oView.getModel("displayModel");

            // 1. Lấy cấu hình cột và dữ liệu đang hiển thị trên bảng
            var aMeta = oDisplayModel.getProperty("/Meta");
            var aData = oDisplayModel.getProperty("/Data");
            var sTableName = oView.getModel("overall").getProperty("/tableName") || "ExportedData";

            // Kiểm tra xem bảng có trống không
            if (!aData || aData.length === 0) {
                MessageToast.show("No data available for download!");
                return;
            }

            // 2. Cấu hình mảng Cột (Columns) cho thư viện Excel
            var aCols = [];
            aMeta.forEach(function (oMetaItem, index) {
                aCols.push({
                    label: oMetaItem.scrtext_l || oMetaItem.scrtext_m || oMetaItem.fieldname, // Tên cột hiển thị
                    property: index + "/value", // Đường dẫn móc dữ liệu (Ví dụ: 0/value, 1/value)
                    type: "string" // Xuất tất cả dưới dạng chuỗi cho an toàn, không bị nhảy format ngày tháng
                });
            });

            // 3. Đóng gói Settings cho file Excel
            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: "Data Sheet"
                    }
                },
                dataSource: aData,
                fileName: sTableName + ".xlsx", // Tên file tự động theo tên bảng
                worker: false 
            };

            // 4. Kích hoạt tải xuống
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build()
                .then(function () {
                    MessageToast.show("Tải file Excel thành công!");
                })
                .catch(function (sMessage) {
                    console.error("Lỗi xuất Excel: ", sMessage);
                    MessageToast.show("Có lỗi xảy ra khi xuất file!");
                })
                .finally(function () {
                    oSheet.destroy(); // Dọn dẹp bộ nhớ trình duyệt sau khi tải xong
                });
        }
    };
});