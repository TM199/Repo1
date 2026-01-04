#!/usr/bin/env python3
"""Generate Mentis Digital BD Automation Pricing PDF"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Colors
NAVY = HexColor('#1a2744')
DARK_NAVY = HexColor('#0f1729')
LIGHT_NAVY = HexColor('#2d3a52')
WHITE = HexColor('#ffffff')
LIGHT_GRAY = HexColor('#f5f5f7')
ACCENT = HexColor('#3b82f6')
GOLD = HexColor('#d4a84b')
TEXT_GRAY = HexColor('#64748b')

def create_pricing_pdf(output_path):
    width, height = A4
    c = canvas.Canvas(output_path, pagesize=A4)

    # Background
    c.setFillColor(WHITE)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Header bar
    c.setFillColor(NAVY)
    c.rect(0, height - 80*mm, width, 80*mm, fill=1, stroke=0)

    # Logo/Brand area
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(20*mm, height - 30*mm, "MENTIS")
    c.setFillColor(ACCENT)
    c.drawString(20*mm + c.stringWidth("MENTIS", "Helvetica-Bold", 28), height - 30*mm, "DIGITAL")

    # Tagline
    c.setFillColor(HexColor('#94a3b8'))
    c.setFont("Helvetica", 11)
    c.drawString(20*mm, height - 38*mm, "BD Automation for Recruitment Agencies")

    # Main title
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20*mm, height - 60*mm, "Service Pricing")

    c.setFont("Helvetica", 12)
    c.drawString(20*mm, height - 68*mm, "Automated outreach systems that book qualified meetings")

    # Pricing tiers - starting position
    start_y = height - 95*mm
    card_width = 85*mm
    card_height = 115*mm
    margin = 12*mm

    tiers = [
        {
            "name": "Starter",
            "upfront": "£3,500",
            "software": "£1,000",
            "retainer": "£500",
            "features": [
                "1-2 ICP profiles",
                "Email outreach",
                "Basic CRM integration",
                "Signal Mentis access",
                "Monthly reporting"
            ],
            "highlight": False
        },
        {
            "name": "Growth",
            "upfront": "£6,500",
            "software": "£1,500",
            "retainer": "£1,000",
            "features": [
                "Up to 5 ICPs",
                "Email + LinkedIn",
                "Full CRM integration",
                "Team training (5 users)",
                "Bi-weekly optimization"
            ],
            "highlight": True
        },
        {
            "name": "Scale",
            "upfront": "£10,000",
            "software": "£2,000",
            "retainer": "£1,500",
            "features": [
                "Up to 10 ICPs",
                "Full multichannel",
                "Advanced CRM workflows",
                "Team onboarding (15)",
                "Weekly optimization"
            ],
            "highlight": False
        },
        {
            "name": "Enterprise",
            "upfront": "£15,000+",
            "software": "£2,500+",
            "retainer": "£2,000+",
            "features": [
                "Unlimited ICPs",
                "Custom integrations",
                "Dedicated account mgr",
                "Priority support",
                "Quarterly strategy"
            ],
            "highlight": False
        }
    ]

    for i, tier in enumerate(tiers):
        x = 12*mm + i * (card_width + 3*mm)
        y = start_y - card_height

        # Card background
        if tier["highlight"]:
            c.setFillColor(NAVY)
            c.roundRect(x - 2*mm, y - 5*mm, card_width + 4*mm, card_height + 12*mm, 8, fill=1, stroke=0)
            text_color = WHITE
            label_color = HexColor('#94a3b8')

            # Popular badge
            c.setFillColor(GOLD)
            c.setFont("Helvetica-Bold", 8)
            badge_text = "MOST POPULAR"
            badge_width = c.stringWidth(badge_text, "Helvetica-Bold", 8) + 8*mm
            c.roundRect(x + (card_width - badge_width)/2, start_y + 2*mm, badge_width, 5*mm, 2, fill=1, stroke=0)
            c.setFillColor(DARK_NAVY)
            c.drawCentredString(x + card_width/2, start_y + 3.5*mm, badge_text)
        else:
            c.setFillColor(LIGHT_GRAY)
            c.roundRect(x, y, card_width, card_height, 6, fill=1, stroke=0)
            text_color = NAVY
            label_color = TEXT_GRAY

        # Tier name
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(x + card_width/2, start_y - 12*mm, tier["name"])

        # Pricing section
        pricing_y = start_y - 25*mm

        # Upfront
        c.setFillColor(label_color)
        c.setFont("Helvetica", 8)
        c.drawCentredString(x + card_width/2, pricing_y, "UPFRONT BUILD")
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(x + card_width/2, pricing_y - 7*mm, tier["upfront"])

        # Divider line
        pricing_y -= 14*mm
        c.setStrokeColor(label_color if not tier["highlight"] else HexColor('#3d4a62'))
        c.setLineWidth(0.5)
        c.line(x + 10*mm, pricing_y, x + card_width - 10*mm, pricing_y)

        # Monthly costs
        pricing_y -= 8*mm
        c.setFillColor(label_color)
        c.setFont("Helvetica", 7)
        c.drawString(x + 5*mm, pricing_y, "Software/mo:")
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(x + card_width - 5*mm, pricing_y, tier["software"])

        pricing_y -= 6*mm
        c.setFillColor(label_color)
        c.setFont("Helvetica", 7)
        c.drawString(x + 5*mm, pricing_y, "Retainer/mo:")
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(x + card_width - 5*mm, pricing_y, tier["retainer"])

        # Features
        feature_y = pricing_y - 12*mm
        c.setFont("Helvetica", 8)
        for feature in tier["features"]:
            c.setFillColor(ACCENT if tier["highlight"] else NAVY)
            c.drawString(x + 5*mm, feature_y, "•")
            c.setFillColor(text_color)
            c.drawString(x + 10*mm, feature_y, feature)
            feature_y -= 5.5*mm

    # Software costs explanation box
    box_y = start_y - card_height - 25*mm
    c.setFillColor(HexColor('#f0f4f8'))
    c.roundRect(12*mm, box_y - 28*mm, width - 24*mm, 28*mm, 4, fill=1, stroke=0)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18*mm, box_y - 8*mm, "What's included in Software Costs")

    c.setFillColor(TEXT_GRAY)
    c.setFont("Helvetica", 9)
    c.drawString(18*mm, box_y - 16*mm, "Signal Mentis (lead intelligence)  •  Enrichment APIs (LeadMagic, Prospeo)  •  Outreach automation (Instantly/Smartlead)")
    c.drawString(18*mm, box_y - 23*mm, "LinkedIn automation tools  •  CRM integrations  •  All data provider costs")

    # What you get section
    section_y = box_y - 45*mm
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(12*mm, section_y, "What You Get")

    benefits = [
        ("Qualified Meetings", "We find companies in pain and book meetings with decision-makers"),
        ("Full Automation", "Multichannel outreach runs without your team lifting a finger"),
        ("Your Tech, Our Expertise", "We build on tools you control - no vendor lock-in"),
    ]

    benefit_y = section_y - 12*mm
    for title, desc in benefits:
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(18*mm, benefit_y, title)
        c.setFillColor(TEXT_GRAY)
        c.setFont("Helvetica", 9)
        c.drawString(18*mm, benefit_y - 6*mm, desc)
        benefit_y -= 18*mm

    # Footer
    c.setFillColor(NAVY)
    c.rect(0, 0, width, 18*mm, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(12*mm, 8*mm, "Ready to automate your BD?")

    c.setFillColor(ACCENT)
    c.setFont("Helvetica", 11)
    c.drawRightString(width - 12*mm, 8*mm, "mentisdigital.co.uk")

    c.save()
    print(f"PDF created: {output_path}")

if __name__ == "__main__":
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, "../mentis-digital-pricing.pdf")
    create_pricing_pdf(output_path)
