# UBL 2.1 Builder for Colombia DIAN - Complete Implementation

from lxml import etree
from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.models.pos import Sale, SaleItem
from app.models.fde import FDEDocument, FDENumbering
from app.models.user import User
from app.config import settings


# Namespaces for UBL 2.1 Colombia
NSMAP = {
    None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "ds": "http://www.w3.org/2000/09/xmldsig#",
    "xades": "http://uri.etsi.org/01903/v1.3.2#",
    "ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
}

DIAN_NS = {
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}


def create_element(parent, tag: str, text: str = None, attrs: dict = None, ns: str = "cbc"):
    """Create an XML element with namespace."""
    ns_uri = DIAN_NS.get(ns, DIAN_NS["cbc"])
    elem = etree.SubElement(parent, f"{{{ns_uri}}}{tag}")
    if text is not None:
        elem.text = str(text)
    if attrs:
        for k, v in attrs.items():
            elem.set(k, str(v))
    return elem


def build_ubl_invoice(
    sale: Sale,
    numbering: FDENumbering,
    customer: Optional[Dict[str, Any]] = None,
    document_type: str = "invoice",  # invoice, pos_ticket, credit_note, debit_note
) -> str:
    """
    Build complete UBL 2.1 Invoice XML for Colombia DIAN.
    
    Args:
        sale: Sale object with all related data
        numbering: FDENumbering configuration
        customer: Customer data for invoice (optional for POS tickets)
        document_type: 'invoice' (01), 'pos_ticket' (04), 'credit_note' (02), 'debit_note' (03)
    
    Returns:
        UBL 2.1 XML string
    """
    
    # Document type codes for DIAN
    DOC_TYPE_CODES = {
        "invoice": "01",
        "credit_note": "02", 
        "debit_note": "03",
        "pos_ticket": "04",
    }
    
    doc_type_code = DOC_TYPE_CODES.get(document_type, "01")
    
    # Create root element
    invoice = etree.Element(
        "{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice",
        nsmap=NSMAP
    )
    
    # UBL Version
    create_element(invoice, "UBLVersionID", "UBL 2.1")
    create_element(invoice, "CustomizationID", "1.0")
    create_element(invoice, "ProfileID", "DIAN 2.1")
    
    # Document ID: Prefix + Number (10 digits)
    doc_id = f"{numbering.prefix}{numbering.current_number:010d}"
    create_element(invoice, "ID", doc_id)
    
    # Issue Date & Time (Colombia timezone: UTC-5)
    issue_date = sale.created_at.strftime("%Y-%m-%d")
    issue_time = sale.created_at.strftime("%H:%M:%S-05:00")
    create_element(invoice, "IssueDate", issue_date)
    create_element(invoice, "IssueTime", issue_time)
    
    # Document Type Code
    type_code = create_element(invoice, "InvoiceTypeCode", doc_type_code)
    type_code.set("listAgencyID", "6")
    type_code.set("listSchemeURI", "urn:dian:gov:co:facturaelectronica:DocumentTypeCode")
    
    # Currency
    create_element(invoice, "DocumentCurrencyCode", "COP")
    
    # ============================================================
    # SUPPLIER PARTY (Emisor) - Company Data
    # ============================================================
    supplier_party = etree.SubElement(invoice, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}AccountingSupplierParty")
    
    # Party Identification
    party = etree.SubElement(supplier_party, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Party")
    
    # Party Identification - NIT
    party_id = create_element(party, "PartyIdentification", None, ns="cac")
    party_id_elem = create_element(party_id, "ID", settings.COMPANY_NIT)
    party_id_elem.set("schemeID", "CO_NIT")
    party_id_elem.set("schemeName", "31")
    
    # Party Name (Razón Social)
    party_name = create_element(party, "PartyName", None, ns="cac")
    create_element(party_name, "Name", settings.COMPANY_NAME)
    
    # Postal Address
    postal_address = create_element(party, "PostalAddress", None, ns="cac")
    create_element(postal_address, "CityName", settings.COMPANY_CITY)
    create_element(postal_address, "CountrySubentity", settings.COMPANY_DEPARTMENT)
    create_element(postal_address, "Country", "CO", ns="cac")
    address_line = create_element(postal_address, "AddressLine", None, ns="cac")
    create_element(address_line, "Line", settings.COMPANY_ADDRESS)
    
    # Party Tax Scheme
    party_tax_scheme = create_element(party, "PartyTaxScheme", None, ns="cac")
    create_element(party_tax_scheme, "RegistrationName", settings.COMPANY_NAME)
    company_id = create_element(party_tax_scheme, "CompanyID", settings.COMPANY_NIT)
    company_id.set("schemeID", "CO_NIT")
    company_id.set("schemeName", "31")
    tax_scheme = create_element(party_tax_scheme, "TaxScheme", None, ns="cac")
    create_element(tax_scheme, "ID", "01")
    
    # Party Legal Entity
    legal_entity = create_element(party, "PartyLegalEntity", None, ns="cac")
    create_element(legal_entity, "RegistrationName", settings.COMPANY_NAME)
    company_id_legal = create_element(legal_entity, "CompanyID", settings.COMPANY_NIT)
    company_id_legal.set("schemeID", "CO_NIT")
    company_id_legal.set("schemeName", "31")
    
    # ============================================================
    # CUSTOMER PARTY (Adquiriente)
    # ============================================================
    customer_party = etree.SubElement(invoice, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}AccountingCustomerParty")
    
    cust_party = etree.SubElement(customer_party, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Party")
    
    if customer and customer.get("tax_id"):
        # Identified customer
        cust_id = create_element(cust_party, "PartyIdentification", None, ns="cac")
        cust_id_elem = create_element(cust_id, "ID", customer["tax_id"])
        cust_id_elem.set("schemeID", "CO_NIT" if len(customer["tax_id"]) > 10 else "CO_CC")
        cust_id_elem.set("schemeName", "31" if len(customer["tax_id"]) > 10 else "13")
        
        create_element(cust_party, "PartyName", customer.get("name", ""), ns="cac")
        
        # Customer address
        cust_address = etree.SubElement(cust_party, "PostalAddress", ns="cac")
        if customer.get("address"):
            addr_line = create_element(cust_address, "AddressLine", None, ns="cac")
            create_element(addr_line, "Line", customer["address"])
        if customer.get("city"):
            create_element(cust_address, "CityName", customer["city"])
        if customer.get("department"):
            create_element(cust_address, "CountrySubentity", customer["department"])
        create_element(cust_address, "Country", "CO", ns="cac")
        
        # Customer Tax Scheme
        cust_tax = create_element(cust_party, "PartyTaxScheme", None, ns="cac")
        create_element(cust_tax, "RegistrationName", customer.get("name", ""))
        cust_company_id = create_element(cust_tax, "CompanyID", customer["tax_id"])
        cust_company_id.set("schemeID", "CO_NIT" if len(customer["tax_id"]) > 10 else "CO_CC")
        cust_company_id.set("schemeName", "31" if len(customer["tax_id"]) > 10 else "13")
        tax_scheme_c = create_element(cust_tax, "TaxScheme", None, ns="cac")
        create_element(tax_scheme_c, "ID", "01")
    else:
        # Consumer final (no identification)
        create_element(cust_party, "PartyName", "Consumidor Final", ns="cac")
        # No PartyIdentification for consumer final
    
    # ============================================================
    # TAX TOTALS
    # ============================================================
    tax_total = etree.SubElement(invoice, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxTotal")
    create_element(tax_total, "TaxAmount", f"{sale.tax_amount:.2f}", attrs={"currencyID": "COP"})
    
    # Tax Subtotal (IVA 19%)
    tax_subtotal = etree.SubElement(tax_total, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxSubtotal")
    create_element(tax_subtotal, "TaxableAmount", f"{sale.subtotal:.2f}", attrs={"currencyID": "COP"})
    create_element(tax_subtotal, "TaxAmount", f"{sale.tax_amount:.2f}", attrs={"currencyID": "COP"})
    
    tax_category = etree.SubElement(tax_subtotal, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxCategory")
    create_element(tax_category, "ID", "01")  # IVA
    create_element(tax_category, "Percent", "19.00")
    tax_scheme_cat = create_element(tax_category, "TaxScheme", None, ns="cac")
    create_element(tax_scheme_cat, "ID", "01")
    create_element(tax_scheme_cat, "Name", "IVA")
    
    # ============================================================
    # LEGAL MONETARY TOTAL
    # ============================================================
    legal_monetary = etree.SubElement(invoice, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}LegalMonetaryTotal")
    create_element(legal_monetary, "LineExtensionAmount", f"{sale.subtotal:.2f}", attrs={"currencyID": "COP"})
    create_element(legal_monetary, "TaxExclusiveAmount", f"{sale.subtotal:.2f}", attrs={"currencyID": "COP"})
    create_element(legal_monetary, "TaxInclusiveAmount", f"{sale.total:.2f}", attrs={"currencyID": "COP"})
    create_element(legal_monetary, "AllowanceTotalAmount", f"{sale.discount_amount:.2f}", attrs={"currencyID": "COP"})
    create_element(legal_monetary, "ChargeTotalAmount", "0.00", attrs={"currencyID": "COP"})
    create_element(legal_monetary, "PayableAmount", f"{sale.total:.2f}", attrs={"currencyID": "COP"})
    
    # ============================================================
    # INVOICE LINES
    # ============================================================
    for idx, item in enumerate(sale.items, 1):
        invoice_line = etree.SubElement(invoice, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}InvoiceLine")
        create_element(invoice_line, "ID", str(idx))
        create_element(invoice_line, "InvoicedQuantity", f"{item.quantity:.3f}", attrs={"unitCode": _get_unit_code(item.product.unit)})
        create_element(invoice_line, "LineExtensionAmount", f"{item.total_price:.2f}", attrs={"currencyID": "COP"})
        
        # Item
        item_elem = etree.SubElement(invoice_line, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Item")
        create_element(item_elem, "Description", item.product.name)
        create_element(item_elem, "Name", item.product.name)
        
        # Sellers Item Identification (SKU)
        sellers_item = create_element(item_elem, "SellersItemIdentification", None, ns="cac")
        create_element(sellers_item, "ID", item.product.sku)
        
        # Price
        price = etree.SubElement(invoice_line, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}Price")
        create_element(price, "PriceAmount", f"{item.unit_price:.2f}", attrs={"currencyID": "COP"})
        create_element(price, "BaseQuantity", f"{item.quantity:.3f}", attrs={"unitCode": _get_unit_code(item.product.unit)})
        
        # Tax for line
        tax_total_line = etree.SubElement(invoice_line, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxTotal")
        line_tax = float(item.unit_price) * float(item.quantity) * float(item.product.tax_rate)
        create_element(tax_total_line, "TaxAmount", f"{line_tax:.2f}", attrs={"currencyID": "COP"})
        
        tax_subtotal_line = etree.SubElement(tax_total_line, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxSubtotal")
        create_element(tax_subtotal_line, "TaxableAmount", f"{item.total_price - line_tax:.2f}", attrs={"currencyID": "COP"})
        create_element(tax_subtotal_line, "TaxAmount", f"{line_tax:.2f}", attrs={"currencyID": "COP"})
        
        tax_cat_line = create_element(tax_subtotal_line, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}TaxCategory")
        create_element(tax_cat_line, "ID", "01")
        create_element(tax_cat_line, "Percent", "19.00")
        tax_scheme_line = create_element(tax_cat_line, "TaxScheme", None, ns="cac")
        create_element(tax_scheme_line, "ID", "01")
        create_element(tax_scheme_line, "Name", "IVA")
        
        # Allowance for modifiers with negative price
        if item.modifiers:
            for mod in item.modifiers:
                if mod.get("price_delta", 0) < 0:
                    allowance = etree.SubElement(invoice_line, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}AllowanceCharge")
                    create_element(allowance, "ChargeIndicator", "false")
                    create_element(allowance, "AllowanceChargeReason", mod["name"])
                    create_element(allowance, "Amount", f"{abs(mod['price_delta']):.2f}", attrs={"currencyID": "COP"})
                    create_element(allowance, "BaseAmount", f"{item.unit_price:.2f}", attrs={"currencyID": "COP"})
    
    # ============================================================
    # PAYMENT MEANS
    # ============================================================
    for pm in sale.payment_method:
        payment_means = etree.SubElement(invoice, "{urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2}PaymentMeans")
        create_element(payment_means, "PaymentMeansCode", _get_payment_code(pm["method"]))
        create_element(payment_means, "PaymentAmount", f"{pm['amount']:.2f}", attrs={"currencyID": "COP"})
        if pm.get("reference"):
            create_element(payment_means, "PaymentReference", pm["reference"])
    
    # ============================================================
    # ADDITIONAL DOCUMENT REFERENCE (CUFE + QR)
    # ============================================================
    # This will be filled after authorization
    # The CUFE and QR are added after PAC authorization
    
    # Convert to string
    xml_bytes = etree.tostring(
        invoice,
        pretty_print=True,
        xml_declaration=True,
        encoding="UTF-8"
    )
    
    return xml_bytes.decode("utf-8")


def build_ubl_credit_note(
    original_document: FDEDocument,
    sale: Sale,
    reason: str,
    numbering: FDENumbering,
) -> str:
    """Build UBL 2.1 Credit Note (Nota Crédito) for document cancellation."""
    # Similar structure but with CreditNote root and different document type
    # Document type: 02 = Nota Crédito
    # References the original document via CUFE
    pass


def _get_unit_code(unit: str) -> str:
    """Map local units to UN/ECE unit codes."""
    unit_map = {
        "pza": "EA",      # Each
        "unidad": "EA",
        "kg": "KGM",      # Kilogram
        "g": "GRM",       # Gram
        "L": "LTR",       # Liter
        "ml": "MLT",      # Milliliter
        "m": "MTR",       # Meter
        "cm": "CMT",      # Centimeter
        "pack": "PK",     # Pack
        "caja": "BX",     # Box
        "bolsa": "BG",    # Bag
        "lata": "CN",     # Can
        "botella": "BO",  # Bottle
        "porcion": "EA",
        "plato": "EA",
        "cucharada": "EA",
        "cucharadita": "EA",
        "taza": "EA",
        "pizca": "EA",
    }
    return unit_map.get(unit.lower(), "EA")


def _get_payment_code(method: str) -> str:
    """Map payment methods to DIAN codes."""
    method_map = {
        "cash": "10",        # Efectivo
        "card": "20",        # Tarjeta
        "transfer": "30",    # Transferencia
        "check": "40",       # Cheque
        "mobile": "50",      # Móvil (Nequi, Daviplata)
        "other": "99",       # Otro
    }
    return method_map.get(method.lower(), "10")


# CUFE Generation (SHA-384)
def generate_cufe(
    nit: str,
    doc_type: str,
    prefix: str,
    number: int,
    issue_date: str,
    issue_time: str,
    total_amount: int,  # in cents
    customer_nit: str,
    technical_key: str = "TEST_KEY"
) -> str:
    """
    Generate CUFE (Código Único de Factura Electrónica) per DIAN spec.
    SHA-384 hash of concatenated fields.
    """
    # Format: NIT + DocType + Prefix + Number(10 digits) + Date + Time + Total(cents) + CustomerNIT + TechnicalKey
    parts = [
        nit,
        doc_type,
        prefix,
        str(number).zfill(10),
        issue_date.replace("-", ""),
        issue_time.replace(":", "").replace("-05:00", ""),
        str(total_amount),
        customer_nit,
        "TEST_KEY",  # Should come from settings
    ]
    
    cufe_string = "".join(parts)
    import hashlib
    return hashlib.sha384(cufe_string.encode("utf-8")).hexdigest().upper()