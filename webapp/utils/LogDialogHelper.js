sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/TextArea"
], function (JSONModel, Dialog, Button, VBox, Label, TextArea) {
    "use strict";

    return {
        // Hàm này chuyên làm nhiệm vụ vẽ và mở Popup
        openLogDialog: function (oController, sOldDataFormatted, sNewDataFormatted) {
            
            // 1. Kiểm tra nếu Dialog chưa tồn tại thì mới vẽ mới (Tiết kiệm bộ nhớ)
            if (!oController._oLogDialog) {
                oController._oLogDialog = new Dialog({
                    title: "Details of data changes (JSON)",
                    contentWidth: "600px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new VBox({
                            items: [
                                new Label({ text: "Old Data:", design: "Bold" }).addStyleClass("sapUiTinyMarginTop"),
                                new TextArea({ value: "{dialogModel>/oldData}", width: "100%", rows: 6, editable: false }),
                                
                                new Label({ text: "New Data:", design: "Bold" }).addStyleClass("sapUiSmallMarginTop"),
                                new TextArea({ value: "{dialogModel>/newData}", width: "100%", rows: 6, editable: false })
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    beginButton: new Button({
                        type: "Emphasized",
                        text: "Close",
                        press: function () {
                            oController._oLogDialog.close();
                        }
                    })
                });

                // Nhúng Dialog vào View hiện tại để nó kế thừa các Model
                oController.getView().addDependent(oController._oLogDialog);
            }

            // 2. Nhét dữ liệu cũ & mới vào Model của Dialog
            var oDialogModel = new JSONModel({
                oldData: sOldDataFormatted,
                newData: sNewDataFormatted
            });
            
            oController._oLogDialog.setModel(oDialogModel, "dialogModel");
            
            // 3. Mở Dialog lên
            oController._oLogDialog.open();
        }
    };
});