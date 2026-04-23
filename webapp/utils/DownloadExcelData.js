sap.ui.define([
    "sap/ui/export/Spreadsheet",
    "sap/m/MessageToast"
], function (Spreadsheet, MessageToast) {
    "use strict";

    return {
        onDownloadExcelPress: function (oController) {
            var oView = oController.getView();
            var oDisplayModel = oView.getModel("displayModel");
            var aMeta = oDisplayModel.getProperty("/Meta");
            var aData = oDisplayModel.getProperty("/Data");
            var sTableName = oView.getModel("overall").getProperty("/tableName") || "ExportedData";
            if (!aData || aData.length === 0) {
                MessageToast.show("No data available for download!");
                return;
            }
            var aCols = [];
            aMeta.forEach(function (oMetaItem, index) {
                aCols.push({
                    label: oMetaItem.scrtext_l || oMetaItem.scrtext_m || oMetaItem.fieldname, 
                    property: index + "/value", 
                    type: "string" 
                });
            });
            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: "Data Sheet"
                    }
                },
                dataSource: aData,
                fileName: sTableName + ".xlsx",
                worker: false
            };
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
                    oSheet.destroy();
                });
        }
    };
});