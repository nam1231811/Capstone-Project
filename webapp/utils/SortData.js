sap.ui.define([
    "sap/ui/core/HTML",
    "sap/ui/model/Sorter",
    "sap/m/CheckBox",
    "sap/m/ResponsivePopover",
    "sap/m/Bar",
    "sap/m/Title",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/SegmentedButton",
    "sap/m/SegmentedButtonItem",
    "sap/m/Switch",
    "sap/m/MessageToast"
], function(HTML, Sorter, CheckBox, ResponsivePopover, Bar, Title, Button, VBox, Label, HBox, Text, SegmentedButton, SegmentedButtonItem, Switch, MessageToast) {
    "use strict";

    return {
        onColumnSelect: function(oEvent) {
            oEvent.preventDefault();

            var oColumn = oEvent.getParameter("column");
            if (!oColumn) return;

            var oView = this.getView(),
                oTable = this.byId("dataTable") || this.byId("TablePage"),
                oBinding = oTable ? oTable.getBinding("rows") : null,
                aSorters = oBinding ? oBinding.aSorters : [],
                iColIndex = oColumn.data("colIndex"),
                sColName = oColumn.data("colName"),
                sCurrentSortKey = "none",
                bIsGrouped = false,
                that = this;

            if (aSorters && aSorters.length > 0) {
                var oCurrentSorter = aSorters.find(function(s) { return s.sPath === (iColIndex + "/value"); });
                if (oCurrentSorter) {
                    sCurrentSortKey = oCurrentSorter.bDescending ? "desc" : "asc";
                    bIsGrouped = !!oCurrentSorter.vGroup; 
                }
            }

            if (this._oColumnPopover) {
                this._oColumnPopover.destroy();
            }

            var oMultiSortCheckBox = new CheckBox({
                text: "Multi-sort",
                selected: false
            });

            this._oColumnPopover = new ResponsivePopover({
                showHeader: true,
                contentWidth: "250px", 
                placement: "Bottom",
                customHeader: new Bar({
                    contentMiddle: [new Title({ text: "Column Settings" })],
                    contentRight: [
                        new Button({
                            icon: "sap-icon://decline",
                            type: "Transparent",
                            press: function() { that._oColumnPopover.close(); }
                        })
                    ]
                }),
                content: [
                    new VBox({
                        items: [
                            new Label({ text: "Sort By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new HBox({
                                justifyContent: "SpaceBetween", 
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new Text({ text: sColName }), 
                                    new SegmentedButton({
                                        selectedKey: sCurrentSortKey,
                                        selectionChange: function(oEventSelect) {
                                            var oItem = oEventSelect.getParameter("item"),
                                                sKey = oItem ? oItem.getKey() : oEventSelect.getSource().getSelectedKey(),
                                                bDescending = (sKey === "desc"),
                                                bMultiSort = oMultiSortCheckBox.getSelected();
                                            
                                            that.onSortColumnDirect(bDescending, iColIndex, bMultiSort, false); 
                                        },
                                        items: [
                                            new SegmentedButtonItem({ icon: "sap-icon://sort-ascending", key: "asc", tooltip: "Ascending" }),
                                            new SegmentedButtonItem({ icon: "sap-icon://sort-descending", key: "desc", tooltip: "Descending" })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiTinyMarginBottom"),

                            oMultiSortCheckBox.addStyleClass("sapUiSmallMarginBottom"),

                            new HTML({ content: "<hr style='border: 0; border-top: 1px solid #e5e5e5; margin: 10px 0;'/>" }),

                            new Label({ text: "Group By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new Text({ text: sColName }),
                                    new Switch({
                                        state: bIsGrouped, 
                                        customTextOn: " ", customTextOff: " ",
                                        change: function(oEventSwitch) {
                                            if (oEventSwitch.getParameter("state")) {
                                                that.onSortColumnDirect(false, iColIndex, false, true);
                                                MessageToast.show("Data grouped by: " + sColName);
                                            } else {
                                                if (oBinding) oBinding.sort(null); 
                                                MessageToast.show("Group removed, data reset");
                                            }
                                        }
                                    })
                                ]
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin") 
                ]
            });

            oView.addDependent(this._oColumnPopover);
            this._oColumnPopover.openBy(oColumn.getLabel()); 
        },

        onSortColumnDirect: function(bDescending, iColIndex, bMultiSort, bGroup) {
            var oTable = this.byId("dataTable") || this.byId("TablePage"),
                oBinding = oTable ? oTable.getBinding("rows") : null,
                sPath = iColIndex + "/value",
                aFinalSorters = [];

            if (!oBinding) return;

            var fnGroup = bGroup ? function(oContext) { return oContext.getProperty(sPath); } : false;
            
            var fnComparator = function(a, b) {
                if (a === b) return 0;
                if (a === null || a === undefined) return -1;
                if (b === null || b === undefined) return 1;
                
                var numA = parseFloat(a),
                    numB = parseFloat(b);
                
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                
                return a.toString().localeCompare(b.toString());
            };

            var oNewSorter = new Sorter(sPath, bDescending, fnGroup, fnComparator);

            if (!bGroup && bMultiSort) {
                aFinalSorters = (oBinding.aSorters || []).filter(function(oSorter) {
                    return oSorter.sPath !== sPath;
                });
                aFinalSorters.push(oNewSorter);
            } else {
                aFinalSorters = [oNewSorter];
            }

            oBinding.sort(aFinalSorters);
        }
    };
});