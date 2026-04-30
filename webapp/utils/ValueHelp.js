sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem",
], function (Filter, FilterOperator, SelectDialog, StandardListItem) {
    "use strict";

    return {
        openTableValueHelp: function (oController, oConfig) {
            var oView = oController.getView();
            var oBundle = oView.getModel("i18n") ? oView.getModel("i18n").getResourceBundle() : null;

            if (!oController._pValueHelpDialog) {
                oController._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: oBundle.getText("listTableTitle"), 
                    busyIndicatorDelay: 0, 
                    noDataText: oBundle.getText("noDataText"), 
                    contentWidth: "50%",
                    growing: true,                           
                    growingThreshold: 20,

                    search: function (oEvt) {
                        var sValue = oEvt.getParameter("value");
                        var oFilter = new sap.ui.model.Filter({
                            filters: [
                                new sap.ui.model.Filter("TableName", FilterOperator.Contains, sValue),
                                new sap.ui.model.Filter("Description", FilterOperator.Contains, sValue)
                            ],
                            and: false
                        });
                        oEvt.getSource().getBinding("items").filter([oFilter]);
                    },

                    confirm: function (oEvt) {
                        var oSelectedItem = oEvt.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sName = oSelectedItem.getCells()[0].getTitle();
                            var sDesc = oSelectedItem.getCells()[1].getText();
                            var oCurrentConfig = oController._pValueHelpDialog.data("config");

                            if (oCurrentConfig.inputId) {
                                oController.byId(oCurrentConfig.inputId).setValue(sName);
                            }
                            if (oCurrentConfig.descInputId) {
                                oController.byId(oCurrentConfig.descInputId).setValue(sDesc);
                            }

                            if (oCurrentConfig.callback && typeof oCurrentConfig.callback === "function") {
                                oCurrentConfig.callback.call(oController, sName, sDesc); 
                            }
                        }
                    },

                    columns: [
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle.getText("tableName"), design: "Bold" }) 
                        }),
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle.getText("tableDesc"), design: "Bold" }),
                            minScreenWidth: "Tablet", 
                            demandPopin: true         
                        })
                    ]
                });

                oView.addDependent(oController._pValueHelpDialog);
                
                oController._pValueHelpDialog.bindAggregation("items", {
                    path: "/TableLookup",
                    template: new sap.m.ColumnListItem({
                        type: "Active",
                        cells: [
                            new sap.m.ObjectIdentifier({ 
                                title: "{TableName}" 
                            }),
                            new sap.m.Text({ 
                                text: "{Description}", 
                                wrapping: true 
                            })
                        ]
                    })
                });
            }

            oController._pValueHelpDialog.data("config", oConfig);

            var oBinding = oController._pValueHelpDialog.getBinding("items");
            if (oBinding) { 
                oBinding.filter([]); 
            }
            if (oController._pValueHelpDialog._oSearchField) { 
                oController._pValueHelpDialog._oSearchField.setValue(""); 
            }

            oController._pValueHelpDialog.open();
        },

        openFieldValueHelp: function (oController, oEvent) {
            var oInput = oEvent.getSource();
            var sTableName = oInput.data("tableName");
            var sFieldName = oInput.data("fieldName") ;

            if (!sTableName || !sFieldName) {
                console.error("Missing Metadata for Value Help. Table: " + sTableName + ", Field: " + sFieldName);
                MessageToast.show("Cannot find metadata for this field");
                return;
            }

            if (!oController._oDynamicVHDialog) {
                oController._oDynamicVHDialog = new SelectDialog({
                    title: "Select Value",
                    confirm: oController.onValueHelpConfirm.bind(oController) 
                });
                oController.getView().addDependent(oController._oDynamicVHDialog);
            }

            var aFilters = [
                new Filter("TableName", FilterOperator.EQ, sTableName),
                new Filter("FieldName", FilterOperator.EQ, sFieldName)
            ];

            oController._oDynamicVHDialog.bindAggregation("items", {
                path: "/DynamicVHSet",
                template: new StandardListItem({
                    title: "{KeyValue}",
                    description: "{Description}",
                    info: "{FieldName}"
                }),
                filters: aFilters
            });
            oController._oDynamicVHDialog.data("targetInput", oInput);
            oController._oDynamicVHDialog.open();
        },

        confirmValueHelp: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oDialog = oEvent.getSource();
            var oInput = oDialog.data("targetInput");
            if (oSelectedItem && oInput) {
                var sSelectedKey = oSelectedItem.getTitle();
                oInput.setValue(sSelectedKey);
                oInput.fireChange({ value: sSelectedKey });
            }
        },
    };
});